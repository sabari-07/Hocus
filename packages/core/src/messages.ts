import type { LangCode } from './types.ts';

/** Spoken/announced engine messages. Data only. `{a}`, `{b}`, `{list}` are placeholders. */
export type MessageKey =
  | 'pointFirst'
  | 'didYouMean'
  | 'done'
  | 'cancelled'
  | 'undone'
  | 'redone'
  | 'nothingToUndo'
  | 'nothingToRedo'
  | 'confirmDestructive'
  | 'notUnderstood'
  | 'nothingElse'
  | 'thatWas'
  | 'nothingPointed'
  | 'showSize'
  | 'named'
  | 'cannotDo'
  | 'pointPlace';

export const MESSAGES: Record<LangCode, Record<MessageKey, string>> = {
  en: {
    pointFirst: 'Point at something first.',
    didYouMean: 'Did you mean {list}? Say a number, point again, or say neither.',
    done: 'Done. Say undo to take it back.',
    cancelled: 'Cancelled.',
    undone: 'Undone.',
    redone: 'Redone.',
    nothingToUndo: 'Nothing to undo.',
    nothingToRedo: 'Nothing to redo.',
    confirmDestructive: '{a}? This changes several things. Say yes or press Enter to confirm.',
    notUnderstood: 'I did not catch a command. Try "{a}".',
    nothingElse: 'There is nothing else it could be.',
    thatWas: 'That was {a}.',
    nothingPointed: 'You have not pointed at anything yet.',
    showSize: 'Show me the size with your thumb and finger.',
    named: '{a} is now called {b}.',
    cannotDo: '{a} cannot do that.',
    pointPlace: 'Point at a spot first.',
  },
  hi: {
    pointFirst: 'पहले किसी चीज़ की ओर इशारा करें।',
    didYouMean: 'क्या आपका मतलब {list} था? नंबर बोलें, फिर से इशारा करें, या "कोई नहीं" कहें।',
    done: 'हो गया। वापस लेने के लिए "वापस करो" कहें।',
    cancelled: 'रद्द किया।',
    undone: 'वापस कर दिया।',
    redone: 'फिर से कर दिया।',
    nothingToUndo: 'वापस करने को कुछ नहीं है।',
    nothingToRedo: 'फिर से करने को कुछ नहीं है।',
    confirmDestructive: '{a}? इससे कई चीज़ें बदलेंगी। पक्का करने के लिए "हाँ" कहें या Enter दबाएँ।',
    notUnderstood: 'कोई आदेश समझ नहीं आया। "{a}" आज़माएँ।',
    nothingElse: 'और कोई विकल्प नहीं है।',
    thatWas: 'वह {a} था।',
    nothingPointed: 'आपने अभी तक किसी चीज़ की ओर इशारा नहीं किया।',
    showSize: 'अंगूठे और उंगली से आकार दिखाएँ।',
    named: '{a} का नाम अब {b} है।',
    cannotDo: '{a} ऐसा नहीं कर सकता।',
    pointPlace: 'पहले किसी जगह की ओर इशारा करें।',
  },
  ta: {
    pointFirst: 'முதலில் ஏதாவது ஒன்றைச் சுட்டிக் காட்டுங்கள்.',
    didYouMean: '{list} என்று சொன்னீர்களா? எண்ணைச் சொல்லுங்கள், மீண்டும் சுட்டுங்கள், அல்லது "எதுவும் இல்லை" என்று சொல்லுங்கள்.',
    done: 'முடிந்தது. திரும்பப் பெற "செயல்தவிர்" என்று சொல்லுங்கள்.',
    cancelled: 'ரத்து செய்யப்பட்டது.',
    undone: 'திரும்பப் பெறப்பட்டது.',
    redone: 'மீண்டும் செய்யப்பட்டது.',
    nothingToUndo: 'திரும்பப் பெற எதுவும் இல்லை.',
    nothingToRedo: 'மீண்டும் செய்ய எதுவும் இல்லை.',
    confirmDestructive: '{a}? இது பலவற்றை மாற்றும். உறுதிசெய்ய "ஆம்" என்று சொல்லுங்கள் அல்லது Enter அழுத்துங்கள்.',
    notUnderstood: 'கட்டளை புரியவில்லை. "{a}" என்று முயற்சிக்கவும்.',
    nothingElse: 'வேறு எதுவும் இல்லை.',
    thatWas: 'அது {a}.',
    nothingPointed: 'நீங்கள் இன்னும் எதையும் சுட்டவில்லை.',
    showSize: 'கட்டைவிரல் மற்றும் விரலால் அளவைக் காட்டுங்கள்.',
    named: '{a} இனி {b} என்று அழைக்கப்படும்.',
    cannotDo: '{a} அதைச் செய்ய முடியாது.',
    pointPlace: 'முதலில் ஒரு இடத்தைச் சுட்டுங்கள்.',
  },
};

export function msg(lang: LangCode, key: MessageKey, params: Record<string, string> = {}): string {
  let text = MESSAGES[lang][key] ?? MESSAGES.en[key];
  for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(v);
  return text;
}

export function joinOptions(lang: LangCode, labels: string[]): string {
  const or = lang === 'hi' ? ' या ' : lang === 'ta' ? ' அல்லது ' : ' or ';
  return labels.map((l, i) => `${i + 1}, ${l}`).join(or);
}
