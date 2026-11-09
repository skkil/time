import type { Api } from '#server/api';
import type { ImportFile, commands } from '#types/bindings';

export type Backend = typeof commands;

/** What the remote backend needs from the app around it: an id for this client and file access. */
export type RemoteHost = {
  clientId: string;
  /** Resolves to a label or path to show the user, or null when cancelled. */
  saveFile(
    name: string,
    contents: string,
    type: string,
  ): Promise<string | null>;
  /** Resolves to the picked file's text, or null when cancelled. */
  openFile(accept: string): Promise<string | null>;
  pickImportFiles(): Promise<ImportFile[]>;
};

export type Commands<K extends keyof Backend> = (api: Api) => Pick<Backend, K>;

export type HostCommands<K extends keyof Backend> = (
  api: Api,
  host: RemoteHost,
) => Pick<Backend, K>;
