import { BackendInstance, BackendPublicView } from '../interfaces/backend-instance.interface';
export declare function toPublicBackendView(backend: BackendInstance): BackendPublicView;
export declare function pseudonymizeIp(clientIp: string): string;
