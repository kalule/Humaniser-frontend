import unittest

from author_names import apa_authors, clean_authors, strip_honorifics, surname
from citation_audit import keep_terminal, repair_by_index
from citation_guard import tag_citations
from essay_checks import check_essay, mixed_spelling, new_sources_in_conclusion, unsupported_intensifiers, unterminated_sentences

SOURCES = [
    {'source_id': 'S1', 'title': 'AI tutors', 'authors': ['Ali, A.'], 'year': '2024', 'details': 'Students using the tutor scored higher (p < 0.05).'},
    {'source_id': 'S2', 'title': 'Bias in tools', 'authors': ['Solanki, R.', 'Kumar, R.'], 'year': '2025', 'details': 'A survey of 120 teachers reported concerns about bias.'},
    {'source_id': 'S3', 'title': 'Privacy', 'authors': ['Lee, B.'], 'year': '2023', 'details': 'Interviews describe privacy worries.'},
]


class AuthorNameTest(unittest.TestCase):
    def test_titles_and_post_nominals_are_dropped(self):
        self.assertEqual(strip_honorifics('Dr. Arshad Ali'), 'Arshad Ali')
        self.assertEqual(strip_honorifics('Prof. Jane Smith, PhD'), 'Jane Smith')
        self.assertEqual(strip_honorifics('Dr Rajesh Kumar'), 'Rajesh Kumar')

    def test_two_people_in_one_byline_become_two_authors(self):
        self.assertEqual(clean_authors(['Ritu Solanki and Dr Rajesh Kumar']), ['Ritu Solanki', 'Rajesh Kumar'])
        self.assertEqual(clean_authors(['Ali, A. & Kumar, R.']), ['Ali, A.', 'Kumar, R.'])
        self.assertEqual(clean_authors(['Ali, Arshad; Kumar, Rajesh']), ['Ali, Arshad', 'Kumar, Rajesh'])

    def test_the_reference_list_form_is_clean(self):
        self.assertEqual(apa_authors(['Dr. Arshad Ali']), 'Ali, A.')
        self.assertEqual(apa_authors(['Ritu Solanki and Dr Rajesh Kumar']), 'Solanki, R., & Kumar, R.')
        self.assertEqual(surname('Prof. Jane Smith, PhD'), 'Smith')

    def test_a_surname_that_looks_like_a_title_or_degree_is_kept(self):
        self.assertEqual(clean_authors(['Ma, Y.', 'Sir, A.']), ['Ma, Y.', 'Sir, A.'])   # only a title followed by a name is stripped

    def test_a_two_author_byline_is_cited_in_full_and_tagged_whole(self):
        sources = [{'source_id': 'S1', 'title': 't', 'authors': ['Ritu Solanki and Dr Rajesh Kumar'], 'year': '2025'}]
        self.assertEqual(tag_citations('Solanki and Kumar (2025) report bias.', sources)[0], '[N:S1] report bias.')


class RepairKeepsTheFullStopTest(unittest.TestCase):
    def test_a_replacement_without_its_stop_gets_the_originals(self):
        self.assertEqual(keep_terminal('Privacy risks rise (Ali, 2024).', 'Privacy and bias risks rise (Ali, 2024)'), 'Privacy and bias risks rise (Ali, 2024).')
        self.assertEqual(keep_terminal('He said "stop."', 'He said "halt"'), 'He said "halt".')

    def test_a_replacement_that_already_ends_properly_or_a_midsentence_passage_is_left_alone(self):
        self.assertEqual(keep_terminal('Cost matters.', 'Cost matters more!'), 'Cost matters more!')
        self.assertEqual(keep_terminal('a clause', 'a clause rewritten'), 'a clause rewritten')

    def test_repair_by_index_does_not_join_the_next_sentence_onto_the_citation(self):
        essay = 'Privacy risks rise (Ali, 2024). Bias persists (Lee, 2023).'
        row = {'label': 'unsupported', 'start': 0, 'end': 31, 'sentence': 'Privacy risks rise (Ali, 2024).', 'suggested_fix': 'Privacy concerns are reported (Ali, 2024)'}
        fixed, count = repair_by_index(essay, [row])
        self.assertEqual(count, 1)
        self.assertEqual(fixed, 'Privacy concerns are reported (Ali, 2024). Bias persists (Lee, 2023).')


class EssayChecksTest(unittest.TestCase):
    def test_a_section_with_no_closing_stop_and_a_lost_stop_are_reported(self):
        self.assertEqual(unterminated_sentences(['Fine sentence (Ali, 2024).']), [])
        self.assertIn('Section 1 does not end', unterminated_sentences(['Ends mid-thought (Ali, 2024)'])[0])
        self.assertIn('Section 2 has a citation followed', unterminated_sentences(['Fine.', 'Privacy rises (Ali, 2024) Bias persists too.'])[0])

    def test_a_source_that_first_appears_in_the_conclusion_is_reported(self):
        body = ['Intro (Ali, 2024).', 'Body (Lee, 2023).', 'We conclude, following Solanki and Kumar (2025), that it matters.']
        message = new_sources_in_conclusion(body, SOURCES)
        self.assertEqual(len(message), 1)
        self.assertIn('S2', message[0])
        self.assertEqual(new_sources_in_conclusion(['Intro (Ali, 2024).', 'Body (Lee, 2023).', 'Overall (Ali, 2024) and (Lee, 2023).'], SOURCES), [])

    def test_mixed_british_and_american_spelling_is_reported(self):
        self.assertTrue(mixed_spelling('Personalised learning helps. Personalized plans differ.'))
        self.assertTrue(mixed_spelling('The organisation values behavior change.'))
        self.assertEqual(mixed_spelling('The organisation values behaviour change.'), [])
        self.assertEqual(mixed_spelling('A program of study and a programme note.'), [])   # weak pairs alone prove nothing

    def test_significantly_needs_a_source_that_reports_significance(self):
        text = ['Teachers report concerns significantly more often (Solanki and Kumar, 2025).', 'Students scored significantly higher (Ali, 2024).']
        flagged = unsupported_intensifiers(text, SOURCES)
        self.assertEqual(len(flagged), 1)
        self.assertIn('Solanki', flagged[0])

    def test_a_sentence_opening_with_significantly_and_a_comma_is_not_a_statistical_claim(self):
        self.assertEqual(unsupported_intensifiers(['Significantly, the office began as a propaganda operation (Lee, 2023).'], SOURCES), [])

    def test_a_clean_essay_has_no_warnings(self):
        clean = ['Intro (Ali, 2024).', 'Body (Lee, 2023) and (Solanki and Kumar, 2025).', 'Overall (Ali, 2024).']
        self.assertEqual(check_essay(clean, SOURCES), [])


if __name__ == '__main__':
    unittest.main()
