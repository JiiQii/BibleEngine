import {
    Entity,
    Column,
    JoinColumn,
    OneToMany,
    PrimaryColumn,
    AfterLoad,
    BeforeInsert,
    BeforeUpdate
} from 'typeorm';
import { BibleCrossReference, BibleNote } from '.';
import { generatePhraseId, parsePhraseId } from '../functions/reference.functions';
import { PhraseModifiers, IBiblePhraseRef } from '../models';
import { IBiblePhraseWithNumbers } from '../models/BiblePhrase';

@Entity()
export class BiblePhrase implements IBiblePhraseWithNumbers {
    @PrimaryColumn({ type: 'bigint' })
    id: number;

    // the id encodes the following attribute:
    normalizedReference: Required<IBiblePhraseRef>;

    @Column({ nullable: true })
    joinToRefId?: number;

    @Column()
    versionChapterNum: number;
    @Column()
    versionVerseNum: number;
    @Column({ nullable: true })
    versionSubverseNum?: number;

    @Column({ nullable: true })
    sourceTypeId?: number;

    @Column()
    content: string;

    // this column does not need to be indexed, however it is conceptually very different to what we
    // save within 'modifiers' (it's tied to only one phrase), so we keep it on a seperate column.
    @Column({ nullable: true })
    linebreak?: boolean;

    // everything that is not tied to one single phrase, thus forming groups in the content
    // hierarchy, is saved within 'modifiers'. We don't need to index this, so it's save to group
    // those values together as one serialized JSON in the database. Thus we also keep the schema
    // and types clean and more easy to understand, plus we can easily add new modifiers
    @Column({ nullable: true })
    modifiersJson?: string;
    modifiers?: PhraseModifiers;

    // this is a seperate column so that we can index it
    @Column({ nullable: true })
    quoteWho?: string;

    // this is a seperate column so that we can index it
    @Column({ nullable: true })
    person?: string;

    @Column({ nullable: true })
    strongsJoined?: string;
    strongs?: string[];

    @OneToMany(() => BibleCrossReference, crossReference => crossReference.phrase, {
        cascade: true
    })
    @JoinColumn()
    crossReferences: BibleCrossReference[];

    @OneToMany(() => BibleNote, note => note.phrase, {
        cascade: true
    })
    @JoinColumn()
    notes: BibleNote[];

    constructor(
        phrase: IBiblePhraseWithNumbers,
        reference: Required<IBiblePhraseRef>,
        modifiers?: PhraseModifiers
    ) {
        // typeorm is seemingly creating objects on startup (without passing parameters), so we
        // need to add a guard here
        if (!phrase) return;

        Object.assign(this, phrase);
        this.normalizedReference = reference;
        if (modifiers) {
            // we don't want to save an modifier object without an active modifier to save space
            let hasActiveModifiers = !!Object.values(modifiers).find(
                modifierValue => modifierValue !== false && modifierValue !== 0
            );

            if (hasActiveModifiers) this.modifiers = modifiers;
        }
        if (phrase.crossReferences) {
            this.crossReferences = phrase.crossReferences.map(crossReference => {
                if (!crossReference.range.versionId)
                    crossReference.range.versionId = reference.versionId;
                return new BibleCrossReference(crossReference, true);
            });
        }
        if (phrase.notes) this.notes = phrase.notes.map(note => new BibleNote(note));
    }

    @AfterLoad()
    parse() {
        // since we got this from the DB we know we have an id and we know it has all the data
        const phraseRef = parsePhraseId(this.id!);
        this.normalizedReference = {
            isNormalized: true,
            bookOsisId: phraseRef.bookOsisId,
            normalizedChapterNum: phraseRef.normalizedChapterNum!,
            normalizedVerseNum: phraseRef.normalizedVerseNum!,
            normalizedSubverseNum: phraseRef.normalizedSubverseNum!,
            versionId: phraseRef.versionId!,
            phraseNum: phraseRef.phraseNum!
        };

        if (this.strongsJoined) this.strongs = this.strongsJoined.split(',');
        if (this.modifiersJson) this.modifiers = JSON.parse(this.modifiersJson);
    }

    @BeforeInsert()
    @BeforeUpdate()
    async prepare() {
        this.id = generatePhraseId(this.normalizedReference);
        if (this.strongs) this.strongsJoined = this.strongs.join(',');
        if (this.modifiers) this.modifiersJson = JSON.stringify(this.modifiers);
    }

    getModifierValue<T extends keyof PhraseModifiers>(modifier: T): PhraseModifiers[T] {
        if (this.modifiers && this.modifiers[modifier]) return this.modifiers[modifier];
        else {
            // default values
            if (modifier === 'indentLevel' || modifier === 'quoteLevel') return 0;
            else if (
                modifier === 'person' ||
                modifier === 'quote' ||
                modifier === 'translationChange' ||
                modifier === 'orderedListItem' ||
                modifier === 'unorderedListItem'
            )
                return undefined;
            else return false;
        }
    }
}
