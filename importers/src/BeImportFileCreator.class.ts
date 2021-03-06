import { ConnectionOptions } from 'typeorm';
import * as archiver from 'archiver';
import { BibleEngine } from '@bible-engine/core';
import { writeFileSync, createWriteStream } from 'fs';
import { ensureDirSync } from 'fs-extra';
import { sync as rmDirRecSync } from 'rimraf';

export class BeImportFileCreator {
    private bibleEngine: BibleEngine;

    constructor(dbConfig: ConnectionOptions) {
        this.bibleEngine = new BibleEngine(dbConfig);
    }

    async createVersionFile(versionUid: string, destinationPath: string) {
        const versionData = await this.bibleEngine.getRawVersionData(versionUid);
        const targetDir = destinationPath + '/' + versionData.version.uid;
        const targetFile = `${destinationPath}/${versionData.version.uid}.bef`;

        const p = new Promise<string>((pResolve, pReject) => {
            // create version directory
            ensureDirSync(targetDir);

            writeFileSync(`${targetDir}/version.json`, JSON.stringify(versionData.version));

            const versionIndex = [];
            for (const bookData of versionData.bookData) {
                const filename = `${bookData.book.osisId}.json`;

                // write to json file
                writeFileSync(`${targetDir}/${filename}`, JSON.stringify(bookData));

                // add to index
                versionIndex.push({
                    filename
                });
            }

            // write index file
            writeFileSync(`${targetDir}/index.json`, JSON.stringify(versionIndex));

            // pack everything
            const zipArchive = archiver('zip');
            zipArchive.on('warning', function(err) {
                if (err.code === 'ENOENT') {
                    console.error(err);
                } else {
                    // throw error
                    pReject(err);
                }
            });

            const output = createWriteStream(targetFile);
            output.on('close', function() {
                console.log(
                    `${targetFile} was successfully created with ${zipArchive.pointer()} total bytes`
                );
                rmDirRecSync(targetDir);
                pResolve(targetFile);
            });

            zipArchive.pipe(output);
            zipArchive.glob('*.json', { cwd: targetDir });
            zipArchive.finalize();
        });

        return p;
    }
}
