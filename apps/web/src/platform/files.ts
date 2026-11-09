import type { ImportFile } from '@skkil-time/client/types';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function pick(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () =>
      resolve(Array.from(input.files ?? [])),
    );
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

async function readImport(file: File): Promise<ImportFile> {
  const name = file.name.replace(/\.[^.]*$/, '');
  if (file.size > MAX_IMPORT_BYTES)
    throw { kind: 'invalid', message: `${name} is larger than 5 MB.` };
  return { name, text: await file.text() };
}

/** Saving and opening files in a browser: a download link and a file input. */
export const browserFiles = {
  async saveFile(name: string, contents: string, type: string) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return name;
  },
  async openFile(accept: string) {
    const [file] = await pick(accept, false);
    return file ? file.text() : null;
  },
  async pickImportFiles() {
    return Promise.all((await pick('.csv', true)).map(readImport));
  },
};
