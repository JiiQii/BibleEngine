import { IBibleReferenceRangeNormalized, IBiblePhraseRef } from '../models';
import {
    generateEndReferenceFromRange,
    generatePhraseId,
    generateReferenceId
} from './reference.functions';

/**
 * generates SQL for a range-query on the section table
 *
 * @param {IBibleReferenceRangeNormalized} range
 * @param {string} tableAlias
 * @returns {string} SQL
 */
export const generateBookSectionsSql = (
    range: IBibleReferenceRangeNormalized,
    tableAlias: string
) => {
    const bookPhraseIdStart = generatePhraseId({
        bookOsisId: range.bookOsisId,
        isNormalized: true
    });
    const bookPhraseIdEnd = generatePhraseId({
        bookOsisId: range.bookOsisId,
        normalizedChapterNum: 999,
        isNormalized: true
    });

    const colVersion = `${tableAlias}.versionId`;
    const colSectionStart = `${tableAlias}.phraseStartId`;
    const colSectionEnd = `${tableAlias}.phraseEndId`;
    let sql = '';

    if (range.versionId) sql += `${colVersion} = ${range.versionId} AND `;

    sql += `${colSectionStart} >= ${bookPhraseIdStart} AND ${colSectionEnd} <= ${bookPhraseIdEnd}`;

    // [REFERENCE] we added the versionId column to the sections table, so we don't need to query
    //             the version via the phraseIds. Since this is not stable, we leave the code for
    //             reference.
    // // if we query for a specific version we need to filter out the
    // // version with a little math (due to the nature of our encoded reference integers)
    // if (range.versionId)
    //     sql += `AND cast(${colSectionStart} % 100000000000 / 100000000 as int) = ${
    //         range.versionId
    //     }`;

    return sql;
};

/**
 * generates SQL-WHERE to filter for all paragraphs "in touch" with the range
 * @param {IBibleReferenceRangeNormalized} range
 * @param {string} tableAlias
 */
export const generateParagraphSql = (
    range: IBibleReferenceRangeNormalized & { versionId: number },
    tableAlias: string
) => {
    const refEnd: IBiblePhraseRef = generateEndReferenceFromRange(range);
    // we want to catch the previous and next paragraph as well
    // by using the approach we even get rid of the 'OR' query (using a second index)
    // by just selection 1 more chapter at the beginning and end
    // Note: in order to not loose our original intention to make a wider range (i.e.
    //       selecting the previous paragraph), the start of the range has to also
    //       catch the start of the previous paragraph (i.e. it must be two times the length
    //       of the longest paragraph before the actual range.start)
    const rangePhraseIdStart = generatePhraseId(range) - 20000000000;
    const rangePhraseIdEnd = generatePhraseId(refEnd) + 10000000000;
    const colVersion = `${tableAlias}.versionId`;
    const colSectionStart = `${tableAlias}.phraseStartId`;
    const colSectionEnd = `${tableAlias}.phraseEndId`;

    // since this is an OR query the query optimizer may/will use different indexes for each
    // https://www.sqlite.org/optoverview.html#or_optimizations
    // thats also why we repeat the versionId condition.
    //
    // the three conditions select:
    // - paragraphs that wrap around the range
    // - paragraphs that start within the range
    // - [DISABLED] paragraphs that end within the range (seperate index)
    //
    // (paragraphs that are fully contained in the range or selected by both the 2nd and 3rd
    //  condition)
    return `
        ( ${colVersion} = ${range.versionId} AND (
                ( ${colSectionStart} < ${rangePhraseIdStart} AND
                    ${colSectionEnd} > ${rangePhraseIdEnd} ) OR
                ( ${colSectionStart} >= ${rangePhraseIdStart} AND
                    ${colSectionStart} <= ${rangePhraseIdEnd} )
            )
        )
        /* [DISABLED] OR (
            ${colVersion} = ${range.versionId} AND
            ${colSectionEnd} >= ${rangePhraseIdStart} AND
            ${colSectionEnd} <= ${rangePhraseIdEnd}
        ) */`;
};

/**
 * generates SQL for a range-query on the id of the phrases table
 *
 * @param {IBibleReferenceRangeNormalized} range
 * @param {string} [col='id']
 * @returns {string} SQL
 */
export const generatePhraseIdSql = (range: IBibleReferenceRangeNormalized, col = 'id') => {
    const refEnd = generateEndReferenceFromRange(range);
    let sql = `${col} BETWEEN '${generatePhraseId(range)}' AND '${generatePhraseId(refEnd)}'`;

    // if we query for more than just one verse in a specific version we need to filter out the
    // version with a little math (due to the nature of our encoded reference integers)
    if (
        range.versionId &&
        !// condition for a query for a single verse
        (
            !!range.normalizedChapterNum &&
            !!range.normalizedVerseNum &&
            ((range.normalizedChapterNum === range.normalizedChapterEndNum &&
                range.normalizedVerseNum === range.normalizedVerseEndNum) ||
                (!range.normalizedChapterEndNum && !range.normalizedVerseEndNum))
        )
    )
        sql += 'AND ' + generatePhraseIdVersionSql(range.versionId, col);

    return sql;
};

/**
 * generates SQL-WHERE for the mod-query on the phraseId-integer to filter for a specific version
 *
 * @param {number} versionId
 * @param {string} [col='id']
 */
export const generatePhraseIdVersionSql = (versionId: number, col = 'id') =>
    `cast(${col} % 100000 / 100 as UNSIGNED) = ${versionId}`;

/**
 * generates SQL for a range-query for reference ids
 *
 * @param {IBibleReferenceRangeNormalized} range
 * @param {string} [col='id']
 * @returns {string} SQL
 */
export const generateReferenceIdSql = (range: IBibleReferenceRangeNormalized, col = 'id') => {
    const refEnd: IBibleReferenceRangeNormalized = {
        isNormalized: true,
        bookOsisId: range.bookOsisId,
        normalizedChapterNum: range.normalizedChapterEndNum || range.normalizedChapterNum || 999,
        normalizedVerseNum:
            range.normalizedVerseEndNum ||
            (range.normalizedVerseNum && !range.normalizedChapterEndNum)
                ? range.normalizedVerseNum
                : 999,
        normalizedSubverseNum: range.normalizedSubverseEndNum || 99
    };
    let sql = `${col} BETWEEN '${generateReferenceId(range)}' AND '${generateReferenceId(refEnd)}'`;

    return sql;
};
