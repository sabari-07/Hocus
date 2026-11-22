import fc from 'fast-check';

// FC_SEED makes a property run reproducible (the Crew soak tester uses a date-based seed).
const seed = Number(process.env.FC_SEED ?? '');
if (Number.isFinite(seed) && process.env.FC_SEED) fc.configureGlobal({ seed });
