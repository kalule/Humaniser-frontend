// Read-only diagnostic: synthetic inputs, mocked providers, existing compiled production classes.
using System.Text.Json;
using HumaniseAI.Application.DTOs.Workbench;
using HumaniseAI.Application.Services;
using HumaniseAI.Infrastructure.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

var results = new Dictionary<string, object>();
var child = new SourceRecord { ExtractionStatus = "Ok", KeyFinding = "Scores improved.",
    Population = "Fifth-grade school students", StudentStatus = "Students", DirectionOfEffect = "improvement" };
results["school_sample_for_university_topic"] = EssayOutlineBuilder.PopulationMatch(child, true);
var unrelated = new LiteratureCitation { Title = "Marine algae cultivation", Abstract = "Ocean salinity and coastal algae." };
results["all_ineligible_filter_retained"] = WorkbenchService.FilterByEvidenceAlignment([unrelated],
    "University social media academic grades", EssayDiscipline.General).Count;

var a = new SourceRecord { ExtractionStatus = "Ok", Population = "University students", StudentStatus = "Students",
    DesignType = "experimental", Design = "randomized trial", Manipulation = "AI writing support", Measures = ["writing score"],
    KeyFinding = "Both treatment and control groups improved.", DirectionOfEffect = "improvement", DirectionSummary = "All groups improved." };
var b = new SourceRecord { ExtractionStatus = "Ok", Population = "University students", StudentStatus = "Students",
    DesignType = "correlational", Design = "survey", Manipulation = "AI use", Measures = ["grades"],
    KeyFinding = "AI use correlated with grades.", DirectionOfEffect = "mixed" };
var records = new Dictionary<string, SourceRecord> { ["S1"] = a, ["S2"] = b };
var raw = JsonSerializer.Serialize(new { framework = new { construct = "AI permission", constructDefinition = "Rules for AI use." },
    body = new object[] {
        new { mainClaim = "The intervention improved scores beyond controls.", sources = new[] { new { sourceId = "S1", role = "supports_effect" } } },
        new { mainClaim = "University permission should be conditional.", sources = new[] { new { sourceId = "S2", role = "qualifies_effect" } } } },
    disagreements = Array.Empty<object>(), researchGap = "No study exists on independent competence." });
var outline = EssayOutlineBuilder.Normalise(raw, "Should universities permit generative AI in assessed coursework?", "Permit with safeguards.", records, 3);
results["unsupported_between_group_claim_survived_outline"] = outline.Body.Any(x => x.MainClaim.Contains("beyond controls"));
results["all_group_improvement_receives_causal_ceiling"] = outline.Body.First().Ceiling;
results["universal_absence_gap_survived"] = outline.Conclusion.ResearchGap;
var system = EssayDraftContract.SystemPrompt(outline);
var user = EssayDraftContract.UserPrompt("Should universities permit generative AI in assessed coursework?", outline, records);
File.WriteAllText(Path.Combine(AppContext.BaseDirectory, "assembled-system.txt"), system);
File.WriteAllText(Path.Combine(AppContext.BaseDirectory, "assembled-user.txt"), user);
results["assembled_prompt_requires_fixed_synthesis"] = system.Contains("Synthesis");
results["assembled_prompt_asserts_shared_author_independence"] = system.Contains("reduces the sources' independence");

EssayPoolCandidate Candidate(string id) {
    var s = new LiteratureCitation { PaperId = id, ProviderRecordId = id, SourceEngine = "PubMed",
        Title = "Social media and academic performance", Abstract = "Social media use was associated with academic grades among university students.",
        Authors = ["Researcher, A."], Year = 2024, EvidenceRepresentation = "ProviderAbstract" };
    return new(id, new WriteWithAiReference { SourceId = id, Title = s.Title, Authors = "Researcher, A.", Source = "web",
        Provider = "PubMed", ProviderRecordId = id, Year = 2024 }, s);
}
var claude = new Mock<IClaudeService>();
claude.Setup(x => x.CompleteAsync(It.IsAny<string>(), It.IsAny<string>(), "essay-atomic-claim-verification",
    It.IsAny<string?>(), It.IsAny<CancellationToken>(), It.IsAny<int?>(), It.IsAny<double?>()))
    .ReturnsAsync("{\"citations\":[{\"id\":1,\"claimMatch\":\"yes\",\"confidence\":95,\"reasoning\":\"Supported.\"},{\"id\":2,\"claimMatch\":\"no\",\"confidence\":95,\"supportGrade\":\"Unsupported\",\"reasoning\":\"Does not support this proposition.\"}]}");
var verifier = new EssayCitationVerifier(Mock.Of<IOpenAlexProvider>(), claude.Object, NullLogger<EssayCitationVerifier>.Instance);
var claim = new EssayClaim("C1.1.1", "Social media use is associated with academic grades among university students.", 0, 0, 0,
    EssayAtomicClaimType.Empirical, true, ["S1", "S2"], EssayClaimVerificationStatus.Pending, null, EssayClaimRepairStatus.None);
var verified = await verifier.VerifyClaimsAsync([claim], [Candidate("S1"), Candidate("S2")], EssayDiscipline.General, default);
results["mixed_citation_pair_claim_status"] = verified.Claims.Single().VerificationStatus.ToString();
results["mixed_citation_pair_individual_statuses"] = verified.Verifications.Select(x => new { x.SourceId, Status = x.Status.ToString() }).ToArray();
Console.WriteLine(JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true }));
