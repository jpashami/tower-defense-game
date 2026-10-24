// Tests for "Suggest a feature": the in-game message matches the one in CONTRIBUTING.md.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { buildSuggestPrompt, FEATURE_FORM_URL } = await import('../src/community/featureRequest.ts');

test('CONTRIBUTING.md has the same Claude message as the game', () => {
  const doc = readFileSync(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(doc.includes(buildSuggestPrompt('(your idea here)')), 'update the message in CONTRIBUTING.md to match src/community/featureRequest.ts');
});

test('the form link points at the feature form that exists', () => {
  const form = new URL(FEATURE_FORM_URL).searchParams.get('template')!;
  assert.ok(readFileSync(new URL(`../.github/ISSUE_TEMPLATE/${form}`, import.meta.url), 'utf8').includes('id: idea'));
});
