// The 18 browser journeys of the UX audit (docs/reviews/2026-09-25-ux-audit.md), expressed
// against the current UI: the September 25 script no longer matched it (renamed controls, the
// model, group and key editors became steps). Each journey keeps its claim; comments say where
// the control changed.
// Scope: real Registry HTTP server + production React build; synthetic Bifrost, no native ABI
// or provider inference qualification. The journeys share one page and are destructive, so this
// is one test of sequential steps run against a fresh fixture (see playwright.config.ts).
import { test } from "./fixtures";
import { createJourneyContext } from "./journeys/helpers";
import { authenticationJourney, logoutJourney } from "./journeys/authentication";
import { tourJourney } from "./journeys/tour";
import { catalogOverviewJourneys, catalogBrowsingJourneys } from "./journeys/catalog";
import { addToCardJourney, modelAccessJourneys } from "./journeys/model-accesses";
import { modelReferenceJourneys } from "./journeys/model-references";
import { modelDraftJourney, modelEditorJourneys } from "./journeys/model-editor";
import { modelRegistrationJourneys, decisionsModelJourney, customProviderJourney } from "./journeys/model-registration";
import { groupJourney } from "./journeys/groups";
import { keyCompositionJourneys, keyCreationJourneys, readbackFailureJourney } from "./journeys/key-composition";
import { keyAdoptionPreviewJourneys, keptProviderJourneys } from "./journeys/key-adoption";
import { focusJourney } from "./journeys/focus";
import { metadataJourney } from "./journeys/metadata";
import { localizationJourney } from "./journeys/localization";
import { nativePermissionJourney } from "./journeys/native-permissions";
import { responsiveJourneys } from "./journeys/responsive";
import { catalogResilienceJourneys } from "./journeys/catalog-resilience";

// The first visit is part of the journeys (#96): the guided tour is offered, then remembered.
test.use({ tourSeen: false });

test("UX journeys", async ({ page, pageErrors: errors, browser, baseURL }, testInfo) => {
  const context = await createJourneyContext({ page, errors, browser, baseURL }, testInfo);

  // Keep this order: the themes share one page and the same destructive fixture.
  await authenticationJourney(context);
  await tourJourney(context);
  await catalogOverviewJourneys(context);
  await addToCardJourney(context);
  await catalogBrowsingJourneys(context);
  await modelReferenceJourneys(context);
  await modelDraftJourney(context);
  await modelRegistrationJourneys(context);
  await modelEditorJourneys(context);
  await decisionsModelJourney(context);
  await modelAccessJourneys(context);
  await customProviderJourney(context);
  await groupJourney(context);
  await keyCompositionJourneys(context);
  await keyAdoptionPreviewJourneys(context);
  await focusJourney(context);
  await keyCreationJourneys(context);
  await metadataJourney(context);
  await localizationJourney(context);
  await keptProviderJourneys(context);
  await readbackFailureJourney(context);
  await nativePermissionJourney(context);
  await responsiveJourneys(context);
  await logoutJourney(context);
  await catalogResilienceJourneys(context);
});
