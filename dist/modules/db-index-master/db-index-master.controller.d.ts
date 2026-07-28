import { DbIndexMasterService } from './db-index-master.service';
import { ExplainQueryDto } from './dto/explain-query.dto';
export declare class DbIndexMasterController {
    private readonly service;
    constructor(service: DbIndexMasterService);
    explainQuery(dto: ExplainQueryDto): Promise<import("./interfaces/db-index.interfaces").ExplainResult>;
    listIndexes(): Promise<import("./interfaces/db-index.interfaces").IndexUsageStat[]>;
    unusedIndexes(): Promise<import("./interfaces/db-index.interfaces").IndexUsageStat[]>;
    seqScanTables(): Promise<import("./interfaces/db-index.interfaces").TableScanStat[]>;
    fullReport(): Promise<import("./interfaces/db-index.interfaces").AnalysisReport>;
}
