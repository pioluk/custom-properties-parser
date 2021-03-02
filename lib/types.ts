export type MapKey<M extends Map<any, any>> = M extends Map<infer K, any> ? K : never;
export type MapValue<M extends Map<any, any>> = M extends Map<unknown, infer V> ? V : never;
