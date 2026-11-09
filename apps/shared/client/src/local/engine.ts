export type Arguments = Record<string, unknown>;

export interface Engine {
  mutate(name: string, args: Arguments): Promise<unknown>;
  query(name: string, args: Arguments): Promise<unknown>;
}
