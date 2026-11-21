import redisClient from '../config/redis.ts';

const PRODUCT_CACHE_TTL_SECONDS = Number(process.env.PRODUCT_CACHE_TTL_SECONDS || 60);
const PRODUCT_CACHE_VERSION_KEY = 'products:catalog:version';
const PRODUCT_CACHE_PREFIX = 'products:catalog';

async function getCatalogVersion(): Promise<string> {
	const version = await redisClient.get(PRODUCT_CACHE_VERSION_KEY);
	return version || '1';
}

export async function getProductCache<T>(key: string): Promise<T | null> {
	const cached = await redisClient.get(key);
	return cached ? JSON.parse(cached) as T : null;
}

export async function setProductCache(key: string, value: unknown): Promise<void> {
	await redisClient.set(key, JSON.stringify(value), { EX: PRODUCT_CACHE_TTL_SECONDS });
}

export async function getProductListCacheKey(page: number, limit: number): Promise<string> {
	const version = await getCatalogVersion();
	return `${PRODUCT_CACHE_PREFIX}:list:v${version}:page:${page}:limit:${limit}`;
}

export async function getProductSearchCacheKey(searchTerm: string): Promise<string> {
	const version = await getCatalogVersion();
	return `${PRODUCT_CACHE_PREFIX}:search:v${version}:${encodeURIComponent(searchTerm)}`;
}

export function getProductByIdCacheKey(productId: number): string {
	return `${PRODUCT_CACHE_PREFIX}:id:${productId}`;
}

export async function invalidateProductCache(productIds?: number | number[]): Promise<void> {
	await redisClient.incr(PRODUCT_CACHE_VERSION_KEY);

	if (productIds !== undefined) {
		const ids = Array.isArray(productIds) ? productIds : [productIds];
		await Promise.all(ids.map((productId) => redisClient.del(getProductByIdCacheKey(productId))));
	}
}
