import logging
import re
import tempfile
from typing import AsyncIterator
from urllib.parse import urlparse

import aiohttp
import aiohttp.client_exceptions
import orjson
import summa_embed
from aiokit import AioThing
from aiosumma import SummaClient
from izihawa_ipfs_api import IpfsHttpClient

from .advices import default_field_aliases, default_field_boosts
from .exceptions import IpfsConnectionError
from .utils import is_endpoint_listening


def get_config():
    return {
        "debug": True,
        "api": {
            "http_endpoint": None,
            "max_frame_size_bytes": 2147483648,
            "keep_alive_timeout_seconds": 60,
            "max_connection_age_seconds": 300,
            "max_connection_age_grace_seconds": 600,
        },
        "consumers": {},
        "core": {
            "doc_store_compress_threads": 1,
            "doc_store_cache_num_blocks": 256,
            "indices": {},
            "writer_heap_size_bytes": 1073741824,
        },
    }


def canonoize_base_url(base_url):
    base_url = base_url.rstrip("/")
    if not base_url.startswith("http"):
        base_url = "http://" + base_url
    return base_url


async def query_wrapper(response):
    for scored_document in response.collector_outputs[0].documents.search_documents:
        yield orjson.loads(scored_document.document)


async def load_document(documents: AsyncIterator):
    async for document in documents:
        document = orjson.loads(document)
        if "cid" in document:
            yield document


async def trace_iteration(iter, every_n, **kwargs):
    i = 1
    async for el in iter:
        if i % every_n == 0:
            logging.getLogger("statbox").info({"c": i, **kwargs})
        i += 1
        yield el


async def detect_host_header(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url, allow_redirects=False) as resp:
            if 300 <= resp.status < 400:
                redirection_url = resp.headers["Location"]
                if "localhost" in redirection_url:
                    parsed_url = urlparse(redirection_url)
                    return re.search(r"(.*)\.localhost.*", parsed_url.netloc).group(0)


class StcGeck(AioThing):
    def __init__(
        self,
        ipfs_http_base_url: str = "http://127.0.0.1:8080",
        ipfs_data_directory: str = "/ipns/libstc.cc/data",
        grpc_api_endpoint: str = "127.0.0.1:10082",
        index_alias: str = "stc",
        timeout: int = 300,
        default_cache_size: int = 300,
    ):
        """
        Constructs GECK that may be used to access STC dataset.

        :param ipfs_http_base_url: IPFS HTTP base url, i.e `http://127.0.0.1:8080`
        :param ipfs_data_directory: path to the directory with indices
        :param grpc_api_endpoint:
            endpoint for setting up Summa. If there is Summa listening on the port before launching, then
            GECK uses existing instance otherwise launches its own one
        :param timeout: timeout for requests sent to IPFS
        :param default_cache_size: the CachingDirectory size in bytes
        """
        super().__init__()
        self.ipfs_http_base_url = canonoize_base_url(ipfs_http_base_url)
        self.ipfs_http_client = IpfsHttpClient(self.ipfs_http_base_url, timeout=timeout)
        self.starts.append(self.ipfs_http_client)
        self.ipfs_data_directory = "/" + ipfs_data_directory.strip("/") + "/"
        self.grpc_api_endpoint = grpc_api_endpoint
        self.index_alias = index_alias
        self.default_cache_size = default_cache_size
        self.temp_dir = tempfile.TemporaryDirectory()

        self.is_embed = not is_endpoint_listening(self.grpc_api_endpoint)
        self.summa_embed_server = None

        self.summa_client = SummaClient(
            endpoint=self.grpc_api_endpoint,
            max_message_length=2 * 1024 * 1024 * 1024 - 1,
        )

    async def start(self):
        if self.is_embed:
            server_config = get_config()
            server_config["api"]["grpc_endpoint"] = self.grpc_api_endpoint
            server_config["data_path"] = self.temp_dir.name
            server_config["log_path"] = self.temp_dir.name
            full_path = self.ipfs_http_base_url + self.ipfs_data_directory
            headers_template = {"range": "bytes={start}-{end}"}
            remote_index_config = {
                "remote": {
                    "method": "GET",
                    "url_template": f"{full_path}{{file_name}}",
                    "headers_template": headers_template,
                    "cache_config": {"cache_size": self.default_cache_size},
                }
            }
            logging.getLogger("info").info(
                {
                    "action": "launching_embedded",
                    "remote_index_config": remote_index_config,
                }
            )
            try:
                if host_header := await detect_host_header(full_path):
                    headers_template["host"] = host_header
            except (
                aiohttp.client_exceptions.ClientConnectorError,
                ConnectionRefusedError,
            ) as e:
                raise IpfsConnectionError(base_error=e)
            server_config["core"]["indices"][self.index_alias] = {
                "query_parser_config": {
                    "default_fields": ["all"],
                    "term_limit": 10,
                    "field_aliases": default_field_aliases,
                    "field_boosts": default_field_boosts,
                },
                "config": remote_index_config,
            }
            self.summa_embed_server = summa_embed.SummaEmbedServerBin(server_config)
            await self.summa_embed_server.start()
        try:
            await self.summa_client.start()
        except (
            aiohttp.client_exceptions.ClientConnectorError,
            ConnectionRefusedError,
        ) as e:
            raise IpfsConnectionError(base_error=e)

    async def stop(self):
        await self.summa_client.stop()
        if self.summa_embed_server:
            await self.summa_embed_server.stop()
            self.summa_embed_server = None
        self.temp_dir.cleanup()

    def get_summa_client(self) -> SummaClient:
        """
        Returns Summa client
        :return: Summa client
        """
        return self.summa_client

    async def download(self, id_: str, extension: str = "pdf"):
        """
        Download item by its IPFS CID

        :param cid: IPFS CID to the item required to download
        :return: `bytes` with the file content
        """
        try:
            return await self.ipfs_http_client.get(
                f"/ipns/repo.libstc.cc/{id_}.{extension}"
            )
        except (
            aiohttp.client_exceptions.ClientConnectorError,
            ConnectionRefusedError,
        ) as e:
            raise IpfsConnectionError(base_error=e)
