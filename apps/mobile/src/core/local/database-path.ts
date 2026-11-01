import { File, Paths } from 'expo-file-system';

const DATABASE = 'time.db';

/** A `file://` URI as the plain path SQLite opens. */
export const pathOf = (uri: string): string =>
  decodeURIComponent(uri.replace(/^file:\/\//, ''));

/** The replica's SQLite file, in the app's document directory. */
export const databasePath = (): string =>
  pathOf(new File(Paths.document, DATABASE).uri);
