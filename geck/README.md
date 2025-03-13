# GECK (Garden of Eden Creation Kit)

GECK is a Python library and Bash tool to deploy and access STC - the large corpus of scholarly texts.
GECK includes embedded search engine [Summa](https://github.com/izihawa/summa), helps to feed it with a prepared IPFS-based database of scholarly texts, do search queries over the database and iterate over all documents if you need.

## Install

Firstly, You should have [installed IPFS](https://libstc.cc/#/help/install-ipfs)

Pre-built wheels of `libstc-geck` are available for Python 3.10, 3.11, 3.12 and 3.13

```bash
pip install libstc-geck
```

## Usage

**Attention!** STC does not contain every book or publication in the world. We are constantly increasing coverage but there is still a lot to do.
STC contains metadata for the most of the items, but `links` or `content` fields may be absent.

### CLI

```console
# (Optional) Launch standalone Summa search engine, then you will not have to wait bootstrapping every time.
# It will take a time! Wait until the text `Serving on ...` appears
# If you decided to launch it, switch to another Terminal window
ultranymous@nevermore:~ geck - serve
INFO: Serving on 127.0.0.1:10082

# Iterate over all stored documents
ultranymous@nevermore:~ geck - documents
INFO: Setting up indices...

# Iterate over all stored documents with applying filters
ultranymous@nevermore:~ geck - documents --query-filter '{"match": {"value": "hemoglobin"}}'

# Do a match search by field
ultranymous@nevermore:~ geck - search 'uris:"doi:10.3384/ecp1392a41"'
INFO: Setting up indices...
INFO: Searching uris:doi:10.3384/ecp1392a41...
{"abstract": "In recent years, water hydraulics has been getting more <...> "type": "proceedings-article", "updated_at": 1687530737}

# Do a match search by word. In the example below documents are cut for displaying reason
ultranymous@nevermore:~ geck - search hemoglobin --limit 3
INFO: Setting up indices...
INFO: Searching hemoglobin...
{"abstract": "Abstract\nWe exa <...>
{"abstract": "Abstract\nUsing a <...>
{"abstract": "Regional cerebral <...>
```

You can add `--debug` flag after `geck` to enable debugging output.

### Python

```python
import argparse
import asyncio

from stc_geck.advices import format_document
from stc_geck.client import StcGeck

DEFAULT_LIMIT = 5


async def main(limit: int):
    geck = StcGeck(
        ipfs_http_base_url='http://127.0.0.1:8080',
        timeout=300,
    )

    # Connects to IPFS and instantiate configured indices for searching
    # It will take a time depending on your IPFS performance
    await geck.start()

    # GECK encapsulates Python client to Summa.
    # It can be either external stand-alone server or embed server,
    # but details are hidden behind `SummaClient` interface.
    summa_client = geck.get_summa_client()

    # Match search returns top-5 documents which contain `additive manufacturing` in their title or abstract.
    documents = await summa_client.search_documents({
        "index_alias": "stc",
        "query": {
            "match": {
                "value": "additive manufacturing",
                "query_parser_config": {"default_fields": ["abstract", "title"]}
            }
        },
        "collectors": [{"top_docs": {"limit": limit}}],
        "is_fieldnorms_scoring_enabled": False,
    })

    for document in documents:
        print(format_document(document) + '\n')

    await geck.stop()

if __name__ == "__main__":
    argparser = argparse.ArgumentParser()
    argparser.add_argument('--limit', type=int, default=DEFAULT_LIMIT)
    args = argparser.parse_args()

    asyncio.run(main(args.limit))
```

More example for Python can be found in [examples directory](/geck/examples/search-stc.ipynb)
