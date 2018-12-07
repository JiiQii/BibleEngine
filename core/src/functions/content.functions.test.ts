import { IBibleOutputRich, IBibleOutputRoot, BibleOutput } from '../models';
import { generateBibleDocument } from './content.functions';
import { BibleParagraph, BiblePhrase, BibleSection } from '../entities';

describe('generateBibleDocument', () => {
    let doc: IBibleOutputRoot;

    const phrase1 = new BiblePhrase(
        { content: 'phrase1', versionChapterNum: 1, versionVerseNum: 1 },
        {
            isNormalized: true,
            versionId: 1,
            bookOsisId: 'Gen',
            normalizedChapterNum: 1,
            normalizedVerseNum: 1,
            phraseNum: 1
        }
    );
    phrase1.prepare();

    const phrase2 = new BiblePhrase(
        { content: 'phrase2', versionChapterNum: 1, versionVerseNum: 1 },
        {
            isNormalized: true,
            versionId: 1,
            bookOsisId: 'Gen',
            normalizedChapterNum: 1,
            normalizedVerseNum: 2,
            phraseNum: 2
        },
        { quoteLevel: 1 }
    );
    phrase2.prepare();

    const phrase3 = new BiblePhrase(
        { content: 'phrase3', versionChapterNum: 1, versionVerseNum: 2 },
        {
            isNormalized: true,
            versionId: 1,
            bookOsisId: 'Gen',
            normalizedChapterNum: 1,
            normalizedVerseNum: 2,
            phraseNum: 3
        },
        { quoteLevel: 1 }
    );
    phrase3.prepare();

    const phrase4 = new BiblePhrase(
        { content: 'phrase4', versionChapterNum: 1, versionVerseNum: 2 },
        {
            isNormalized: true,
            versionId: 1,
            bookOsisId: 'Gen',
            normalizedChapterNum: 1,
            normalizedVerseNum: 2,
            phraseNum: 4
        },
        { translationChange: 'change' }
    );
    phrase4.prepare();

    const paragraph1 = new BibleParagraph(1, phrase1.id, phrase3.id);
    paragraph1.id = 1;

    const section1 = new BibleSection({
        versionId: 1,
        level: 1,
        phraseStartId: phrase1.id,
        phraseEndId: phrase3.id
    });
    section1.id = 1;
    const section2 = new BibleSection({
        versionId: 1,
        level: 1,
        phraseStartId: phrase4.id,
        phraseEndId: phrase4.id
    });
    section2.id = 2;
    const section2_1 = new BibleSection({
        versionId: 1,
        level: 2,
        phraseStartId: phrase4.id,
        phraseEndId: phrase4.id
    });
    section2_1.id = 3;

    let item1: BibleOutput;
    let item1_1: BibleOutput;
    let item1_1_2: BibleOutput;
    let item2: BibleOutput;
    let item2_1: BibleOutput;

    beforeAll(() => {
        const phrases: BiblePhrase[] = [phrase1, phrase2, phrase3, phrase4];
        const paragraphs: BibleParagraph[] = [paragraph1];
        const context: IBibleOutputRich['context'] = {
            1: {
                includedSections: [section1, section2],
                nextSections: [],
                previousSections: []
            },
            2: {
                includedSections: [section2_1],
                nextSections: [],
                previousSections: []
            }
        };
        doc = generateBibleDocument(phrases, paragraphs, context);
        item1 = doc.contents[0];
        if (item1.type === 'section') {
            item1_1 = item1.contents[0];
            if (item1_1.type === 'group') {
                item1_1_2 = item1_1.contents[1];
            }
        }
        item2 = doc.contents[1];
        if (item2.type === 'section') {
            item2_1 = item2.contents[0];
        }
    });

    test('should return a root output node', () => {
        expect(doc.type).toBe('root');
    });

    test('should put level 1 section on the top off the hierarchy', () => {
        expect(item1.type).toBe('section');
        expect(item1.type === 'section' && item1.meta.sectionId === section1.id).toBe(true);
    });

    test('should put arrange sections in the correct order', () => {
        expect(item2.type === 'section' && item2.level === 1).toBe(true);
        expect(item2_1.type === 'section' && item2_1.level === 2).toBe(true);
    });

    test('should create new numbering group on verse change', () => {
        expect(
            item1_1 &&
                item1_1.type === 'group' &&
                item1_1.contents.length === 2 &&
                !!item1_1.contents[1].numbering
        ).toBe(true);
    });

    test('should create numbering group on the most outer level possible', () => {
        expect(doc.numbering).toBeDefined();
    });

    test('should group sequential phrases with the same modifier', () => {
        expect(item1_1_2 && item1_1_2.type === 'group' && item1_1_2.contents.length === 2).toBe(
            true
        );
    });
});
