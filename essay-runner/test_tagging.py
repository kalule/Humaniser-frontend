import unittest
from citation_guard import tag_citations

SOURCES = [
    {'source_id': 'S1', 'title': 'Generative AI and grades', 'authors': ['Ngari, P.'], 'year': '2026'},
    {'source_id': 'S2', 'title': 'Nursing students and Grammarly', 'authors': ['Agovic, A.', 'Lee, B.'], 'year': '2025'},
    {'source_id': 'S3', 'title': 'Rubrics in assessment', 'authors': ['Hale, M.'], 'year': '2020'},
]


class TagCitationsTest(unittest.TestCase):
    def test_narrative_citation_becomes_a_narrative_token(self):
        text, untagged = tag_citations('Ngari (2026) highlights a positive association.', SOURCES)
        self.assertEqual(text, '[N:S1] highlights a positive association.')
        self.assertEqual(untagged, 0)

    def test_narrative_with_et_al_and_coauthors(self):
        self.assertEqual(tag_citations('Agovic et al. (2025) found it helpful.', SOURCES)[0], '[N:S2] found it helpful.')
        self.assertEqual(tag_citations('Agovic and Lee (2025) found it helpful.', SOURCES)[0], '[N:S2] found it helpful.')

    def test_parenthetical_group_becomes_adjacent_tokens(self):
        text, untagged = tag_citations('Tools helped (Agovic et al., 2025; Ngari, 2026).', SOURCES)
        self.assertEqual(text, 'Tools helped [S2][S1].')
        self.assertEqual(untagged, 0)

    def test_page_numbers_do_not_stop_a_match(self):
        self.assertEqual(tag_citations('As shown (Hale, 2020, p. 14).', SOURCES)[0], 'As shown [S3].')

    def test_a_group_mixing_words_with_a_citation_is_left_and_counted(self):
        text, untagged = tag_citations('Results vary (see Hale, 2020 for a contrary view and 2019 data).', SOURCES)
        self.assertEqual(untagged, 0)  # one source matched: tagged
        text, untagged = tag_citations('Results vary (Unknown, 2019).', SOURCES)
        self.assertEqual(text, 'Results vary (Unknown, 2019).')
        self.assertEqual(untagged, 1)

    def test_ambiguous_author_year_is_never_tagged(self):
        sources = SOURCES + [{'source_id': 'S4', 'title': 'Another', 'authors': ['Hale, K.'], 'year': '2020'}]
        text, _ = tag_citations('As shown (Hale, 2020).', sources)
        self.assertEqual(text, 'As shown (Hale, 2020).')

    def test_text_without_citations_is_unchanged(self):
        text = 'A plain sentence (with an aside) and no citation.'
        self.assertEqual(tag_citations(text, SOURCES), (text, 0))

    def test_repeated_source_in_one_group_is_deduplicated(self):
        self.assertEqual(tag_citations('(Hale, 2020; Hale, 2020)', SOURCES)[0], '[S3]')


if __name__ == '__main__':
    unittest.main()
