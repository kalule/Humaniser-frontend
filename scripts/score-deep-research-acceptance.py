"""Score exported live cases plus independent judgments; never invent missing labels.

Usage: python scripts/score-deep-research-acceptance.py input.json output.json
Input cases contain package, retrievedSources, and optional judgments:
sources {sourceId: {relevant: bool, geographyCorrect: bool}},
claims {findingStatement: bool}, gaps {questionId: {falseGap: bool}}.
Run the same scorer for baseline cases with workflow='baseline'.
"""
import json
import sys


def normalized(value):
    if isinstance(value, dict):
        return {key.lower(): normalized(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalized(item) for item in value]
    return value


def rate(values):
    labels = [value for value in values if isinstance(value, bool)]
    return {"value": sum(labels) / len(labels) if labels else None,
            "judged": len(labels), "total": len(values)}


def score(case):
    if case.get('workflow') == 'ProposalRetrievalBaseline':
        sources = case.get('judgments', {}).get('sources', {})
        retrieved = {source['id']: source for source in case.get('retrievedsources', [])}
        return {'id': case['id'], 'workflow': case['workflow'],
                'searchPrecision': rate([sources.get(key, {}).get('relevant') for key in retrieved]),
                'relevantSourceRate': {'value': None, 'reason': 'Retrieval is not final evidence acceptance.'},
                'verifiedSourceRate': {'value': None, 'reason': 'Verification is outside this retrieval baseline.'},
                'geographyAccuracy': rate([sources.get(key, {}).get('geographycorrect') for key in retrieved]),
                'claimSupportAccuracy': {'value': None}, 'falseResearchGapRate': {'value': None},
                'searchesPerSession': case['searches'], 'timePerSessionSeconds': case['elapsedseconds'],
                'llmTokensPerSession': 0, 'estimatedLlmCostPerSessionUsd': 0,
                'limitations': case['limitations']}
    package = case["package"]
    labels = case.get("judgments", {})
    sources = labels.get("sources", {})
    accepted = {source["id"]: source for source in package["acceptedevidence"]}
    retrieved = {source["id"]: source for source in case.get("retrievedsources", [])}
    searches = package["searchcoverage"]
    duplicates = sum(search["duplicates"] for search in searches)
    observed = duplicates + sum(search["newcandidates"] for search in searches)
    usage = package["usage"]
    return {"id": case["id"], "workflow": case.get("workflow", "unknown"),
            "searchPrecision": rate([sources.get(key, {}).get("relevant") for key in retrieved]),
            "relevantSourceRate": rate([sources.get(key, {}).get("relevant") for key in accepted]),
            "verifiedSourceRate": rate([source["verification"] == "Verified" for source in accepted.values()]),
            "duplicateRate": duplicates / observed if observed else None,
            "geographyAccuracy": rate([sources.get(key, {}).get("geographycorrect") for key in accepted]),
            "claimSupportAccuracy": rate([labels.get("claims", {}).get(finding["statement"].lower()) for finding in package["keyfindings"]]),
            "contradictoryEvidenceFound": len({source["id"] for source in package["contradictions"] if source["polarity"] == "Contradicts"}),
            "nullEvidenceFound": len({source["id"] for source in package["contradictions"] if source["polarity"] == "Null"}),
            "falseResearchGapRate": rate([labels.get("gaps", {}).get(gap["questionid"], {}).get("falsegap") for gap in package["potentialresearchgaps"]]),
            "searchesPerSession": usage["searches"],
            "llmTokensPerSession": usage["inputtokens"] + usage["outputtokens"],
            "estimatedLlmCostPerSessionUsd": usage["estimatedllmcostusd"],
            "timePerSessionSeconds": usage["elapsedseconds"],
            "completionReason": package["completionreason"]}


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8-sig") as source:
        data = normalized(json.load(source))
    rows = [score(case) for case in data["cases"]]
    result = {"cases": rows, "integrationGate": "Not evaluated: paired baseline and independent quality judgments required.",
              "averageSearchesPerSession": sum(row["searchesPerSession"] for row in rows) / len(rows) if rows else None,
              "estimatedLlmCostTotalUsd": sum(row["estimatedLlmCostPerSessionUsd"] for row in rows),
              "costScope": "LLM estimate only; not a provider billing statement."}
    with open(sys.argv[2], "w", encoding="utf-8") as target:
        json.dump(result, target, indent=2)
