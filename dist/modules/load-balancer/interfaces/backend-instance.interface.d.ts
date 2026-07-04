export interface BackendInstance {
    id: string;
    url: string;
    region: string;
    supportedCurrencies: string[];
    activeConnections: number;
    healthy: boolean;
    lastHealthCheckAt: Date | null;
    weight: number;
}
export interface BackendPublicView {
    id: string;
    region: string;
    supportedCurrencies: string[];
    healthy: boolean;
    activeConnections: number;
}
