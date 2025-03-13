import {grpc_web, IndexQuery, IndexRegistryOptions, RemoteIndexRegistry, seeds} from "summa-wasm";
import {Ref, ref, toRaw, UnwrapRef} from "vue";
import {QueryProcessor} from "./query-processor";
import {GrpcWebFetchTransport} from "@protobuf-ts/grpcweb-transport";


export function get_index_config() {
    return {
        index_name: 'stc',
        seed: new seeds.LocalDatabaseSeed(
            `ipns://libstc.cc/data`,
            grpc_web.index_service.CacheConfig.create({cache_size: 512 * 1024 * 1024})
        ),
        query_parser_config: {
            field_aliases: {
                author: 'authors.name',
                authors: 'authors.name',
                isbn: 'metadata.isbns',
                isbns: 'metadata.isbns',
                issns: 'metadata.issns',
                lang: 'languages',
                language: 'languages',
                ev: 'metadata.event.name',
                nid: 'id',
                pub: 'metadata.publisher',
                rd: 'references.doi',
                ser: 'metadata.series',
                uri: 'uris',
            },
            field_boosts: {
                authors: 2.7,
                title: 2.0
            },
            term_field_mapper_configs: {
                doi_isbn: {fields: ['metadata.isbns']},
                isbn: {fields: ['metadata.isbns']}
            },
            term_limit: 10,
            default_fields: ['all'],
            query_language: "en",
        },
        is_exact_matches_promoted: false,
    }
}

export enum SearchProviderStatus {
  NotSetup = 0,
  NotChecked = 1,
  Checking,
  Failed,
  Succeeded,
}

export interface SearchProvider {
    setup(): Promise<void>;

    healthcheck(): Promise<void>;

    search(index_query: IndexQuery, options: QueryOptions): Promise<object[]>;
}

const wasm_url = new URL(
    'summa-wasm/dist/index_bg.wasm',
    import.meta.url
)

export class IpfsSearchProvider implements SearchProvider {
    init_guard: Promise<void>;
    remote_index_registry: RemoteIndexRegistry;
    index_config: any;
    query_processor: QueryProcessor;
    name: string;
    status: Ref<UnwrapRef<SearchProviderStatus>>;
    current_init_status: any;
    registry_options?: IndexRegistryOptions;
    page_size: number;

    constructor(current_init_status, registry_options?: IndexRegistryOptions) {
        this.current_init_status = current_init_status
        this.registry_options = registry_options
        this.index_config = get_index_config();
        this.query_processor = new QueryProcessor();
        this.name = "IPFS";
        this.status = ref(SearchProviderStatus.NotSetup);
        this.page_size = 5;
    }

    async setup() {
        if (this.init_guard) {
            return await this.init_guard;
        }
        this.init_guard = (async () => {
            const worker_url = new URL(
                'summa-wasm/dist/root-worker.js',
                import.meta.url
            )
            this.remote_index_registry = new RemoteIndexRegistry(
                worker_url,
                wasm_url,
                this.registry_options,
                []
            )
            await this.remote_index_registry.init_guard
            await this.inner_setup()
        })()
        return await this.init_guard
    }

    async inner_setup() {
        try {
            await this.add_index(this.index_config);
            this.status.value = SearchProviderStatus.NotChecked;
            this.current_init_status.value = undefined;
            await this.healthcheck();
        } catch (e) {
            console.error('Dropping stored data due to error: ', e)
            throw e
        }
    }

    async add_index(index_config: {
        index_name: string
        seed: seeds.IIndexSeed
        query_parser_config: any
    }): Promise<Object> {
        const remote_engine_config =
            await index_config.seed.retrieve_remote_engine_config()
        return await this.remote_index_registry.add(index_config.index_name, {
            config: {remote: remote_engine_config},
            query_parser_config: toRaw(index_config.query_parser_config)
        })
    }

    async search(index_query: IndexQuery, options: QueryOptions) {
        await this.init_guard
        options.page_size = options.page_size ?? this.page_size;
        const parsed_index_query = this.query_processor.generate_request(this.index_config, index_query, options)
        return await this.remote_index_registry.search_by_binary_proto(grpc_web.query.SearchRequest.toBinary(grpc_web.query.SearchRequest.fromJson(parsed_index_query)))
    }

    async healthcheck(): Promise<void> {
        this.status.value = SearchProviderStatus.Succeeded;
    }
}

export class RemoteSearchProvider implements SearchProvider {
    search_api: grpc_web.public_service_client.PublicApiClient;
    index_config: Object;
    name: string;
    query_processor: QueryProcessor;
    status: Ref<UnwrapRef<SearchProviderStatus>>;
    page_size: number;

    constructor(base_url: string, name: string) {
        const transport = new GrpcWebFetchTransport({
            baseUrl: base_url,
            format: "binary",
        });
        this.search_api = new grpc_web.public_service_client.PublicApiClient(transport);
        this.index_config = get_index_config();
        this.name = name;
        this.query_processor = new QueryProcessor();
        this.status = ref(SearchProviderStatus.NotSetup);
        this.page_size = 10;
    }

    async setup() {
        await this.healthcheck();
    }

    async search(index_query: IndexQuery, options: QueryOptions): Promise<object[]> {
        options.page_size = options.page_size ?? this.page_size;
        options.query_parser_config = this.index_config.query_parser_config;
        const parsed_index_query = this.query_processor.generate_request(this.index_config, index_query, options);
        const { response } = await this.search_api.search(grpc_web.query.SearchRequest.fromJson(parsed_index_query));
        return response.collector_outputs
    }

    async healthcheck(): Promise<void> {
        try {
            this.status.value = SearchProviderStatus.Checking;
            await this.search_api.search(grpc_web.query.SearchRequest.fromJson({"index_alias": "stc", "query": {"empty": {}}}));
            this.status.value = SearchProviderStatus.Succeeded;
        } catch(e) {
            this.status.value = SearchProviderStatus.Failed;
        }
    }
}
