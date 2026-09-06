(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJNazorjevaEngine = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var VERSION = "nazorjeva-engine-v1";
  var CONTEXT_VERSION = "atena-interface-context-v2";
  var DEFINITION_VERSION = "nazorjeva-widget-definition-v1";
  var CAPABILITY_VERSION = "nazorjeva-capability-signature-v1";
  var QUESTION_BINDING_VERSION = "nazorjeva-question-binding-v1";
  var LUNA_MANIFEST_VERSION = "nazorjeva-luna-manifest-v1";

  var LIFECYCLE = Object.freeze({
    draft:Object.freeze(["test","rejected"]),
    test:Object.freeze(["iterating","ready_for_approval","rejected"]),
    iterating:Object.freeze(["test","ready_for_approval","rejected"]),
    ready_for_approval:Object.freeze(["iterating","approved","rejected"]),
    approved:Object.freeze(["test"]),
    rejected:Object.freeze(["test"])
  });

  var ID_PATTERNS = Object.freeze({
    widget:/^atena:widget:[a-z0-9]+(?:-[a-z0-9]+)*$/,
    card:/^atena:card:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/,
    field:/^atena:field:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/,
    control:/^atena:control:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/,
    option:/^atena:option:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/,
    relation:/^atena:relation:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/
  });

  var NATIVE_COLOR_TOKENS = Object.freeze(["--obrazec-barva","--obrazec-ozadje","--card-rgb"]);
  var BLOCKING_COLLISIONS = Object.freeze(["EXACT_DUPLICATE","FUNCTIONAL_OVERLAP"]);

  function asArray(value) { return Array.isArray(value) ? value : []; }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function slug(value) {
    return text(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function unique(values) { return Array.from(new Set(asArray(values).map(text).filter(Boolean))); }
  function sorted(values) { return unique(values).sort(); }
  function frozenArray(values) { return Object.freeze(asArray(values).slice()); }
  function fail(code, message, details) {
    var error = new Error(message);
    error.code = code;
    error.details = details || null;
    throw error;
  }
  function assertText(value, code, label) {
    if (!text(value)) fail(code, "NAZORJEVA: manjka " + label + ".");
    return text(value);
  }
  function boundedText(value, max, code, label) {
    var result = assertText(value, code, label);
    if (result.length > max) fail("VALUE_TOO_LONG", "NAZORJEVA: " + label + " presega " + max + " znakov.", { label:label, max:max, actual:result.length });
    return result;
  }
  function safeIdPart(value, label) {
    var id = slug(value);
    if (!id) fail("INVALID_ID_PART", "NAZORJEVA: neveljaven del ID-ja " + label + ".");
    return id;
  }
  function interfaceId(kind, parts) {
    if (!ID_PATTERNS[kind]) fail("UNKNOWN_ID_KIND", "NAZORJEVA: neznana vrsta ID-ja " + kind + ".");
    var value = "atena:" + kind + ":" + asArray(parts).map(function (part, index) { return safeIdPart(part, kind + "[" + index + "]"); }).join(":");
    if (!ID_PATTERNS[kind].test(value)) fail("INVALID_INTERFACE_ID", "NAZORJEVA: neveljaven " + kind + " ID " + value + ".");
    return value;
  }

  function stableIds(flow, moduleId, fieldId, options, relationIds, controlRoles) {
    var f = safeIdPart(flow, "flow");
    var modulePart = safeIdPart(moduleId, "moduleId");
    var base = { card:interfaceId("card", [f,modulePart]) };
    if (fieldId == null || text(fieldId) === "") return Object.freeze(base);
    var fieldPart = safeIdPart(fieldId, "fieldId");
    base.field = interfaceId("field", [f,modulePart,fieldPart]);
    base.controls = Object.freeze(unique(asArray(controlRoles).length ? controlRoles : ["primary"]).map(function (role) {
      return Object.freeze({ role:safeIdPart(role, "controlRole"), interfaceId:interfaceId("control", [f,modulePart,fieldPart,role]) });
    }));
    base.options = Object.freeze(asArray(options).map(function (option) {
      var optionId = option && (option.id != null ? option.id : option.value);
      return Object.freeze({ id:text(optionId), label:text(option && option.label), interfaceId:interfaceId("option", [f,modulePart,fieldPart,optionId]) });
    }));
    base.relations = Object.freeze(unique(relationIds).map(function (relationId) {
      return Object.freeze({ id:safeIdPart(relationId, "relationId"), interfaceId:interfaceId("relation", [f,modulePart,relationId]) });
    }));
    return Object.freeze(base);
  }

  function validateIdRegistry(records) {
    var seen = new Map();
    var missing = [];
    var invalid = [];
    var duplicates = [];
    asArray(records).forEach(function (record, index) {
      var id = text(typeof record === "string" ? record : record && record.interfaceId);
      if (!id) { missing.push(index); return; }
      var kind = id.split(":")[1];
      if (!ID_PATTERNS[kind] || !ID_PATTERNS[kind].test(id)) invalid.push(id);
      if (seen.has(id)) duplicates.push(id); else seen.set(id, index);
    });
    var ok = !missing.length && !invalid.length && !duplicates.length;
    return Object.freeze({ ok:ok, code:ok ? "IDS_VALID" : "IDS_INVALID", total:asArray(records).length,
      missing:Object.freeze(missing), invalid:Object.freeze(unique(invalid)), duplicates:Object.freeze(unique(duplicates)) });
  }

  function capabilitySignature(definition) {
    var data = definition && definition.data || {};
    var validation = definition && definition.validation || {};
    var persistence = definition && definition.persistence || {};
    var signature = {
      version:CAPABILITY_VERSION,
      scope:assertText(data.scope || definition && definition.scope, "CAPABILITY_SCOPE_MISSING", "capability scope"),
      canonicalShape:assertText(data.canonicalShape || definition && definition.dataShape, "CANONICAL_SHAPE_MISSING", "canonical obliko"),
      semanticTags:Object.freeze(sorted(data.semanticTags || definition && definition.semanticTags)),
      interactions:Object.freeze(sorted(data.allowedInteractions || definition && definition.allowedInteractions)),
      required:Boolean(validation.required),
      conditional:Boolean(validation.showWhen || validation.conditionalRules && validation.conditionalRules.length),
      validationRule:assertText(validation.rule || definition && definition.validation, "VALIDATION_RULE_MISSING", "validacijsko pravilo"),
      storage:assertText(persistence.storage || "existing-draft", "PERSISTENCE_MISSING", "persistence storage")
    };
    signature.key = [signature.scope,signature.canonicalShape,signature.semanticTags.join(","),signature.interactions.join(","),signature.required ? "required" : "optional",signature.conditional ? "conditional" : "direct",signature.validationRule,signature.storage].join("|");
    return Object.freeze(signature);
  }

  function materializeWidgetDefinition(input) {
    input = input || {};
    var id = assertText(input.id, "WIDGET_ID_MISSING", "widget ID");
    var identity = input.identity || {};
    var intent = input.intent || {};
    var data = input.data || {};
    var validation = input.validation || {};
    var ui = input.ui || {};
    var persistence = input.persistence || {};
    var questionBinding = input.questionBinding || {};
    var interfaceValue = interfaceId("widget", [id]);
    var examples = unique(intent.examples || input.examples);
    if (!examples.length) fail("EXAMPLES_MISSING", "NAZORJEVA: widget " + id + " nima realnega primera.");
    var definition = {
      version:DEFINITION_VERSION,
      id:id,
      interfaceId:interfaceValue,
      status:text(identity.status || input.status || "test"),
      identity:Object.freeze({ templateId:id, number:Number(identity.number || input.number), title:boundedText(identity.title || input.title, 80, "TITLE_MISSING", "naslov"), origin:text(identity.origin || "NAZORJEVA-TEST") }),
      intent:Object.freeze({ purpose:boundedText(intent.purpose || input.purpose, 500, "PURPOSE_MISSING", "namen"), mentalModel:boundedText(intent.mentalModel || input.mentalModel, 240, "MENTAL_MODEL_MISSING", "mentalni model"), suitable:boundedText(intent.suitable || input.suitable, 500, "SUITABLE_MISSING", "primerne uporabe"), unsuitable:boundedText(intent.unsuitable || input.unsuitable, 500, "UNSUITABLE_MISSING", "neprimerne uporabe"), examples:Object.freeze(examples.map(function (example) { return boundedText(example, 400, "EXAMPLE_MISSING", "primer"); })), antiPatterns:Object.freeze(unique(intent.antiPatterns || [intent.unsuitable || input.unsuitable]).map(function (pattern) { return boundedText(pattern, 500, "ANTI_PATTERN_MISSING", "anti-pattern"); })) }),
      data:Object.freeze({ scope:assertText(data.scope || input.scope, "CAPABILITY_SCOPE_MISSING", "scope"), canonicalShape:assertText(data.canonicalShape || input.dataShape, "CANONICAL_SHAPE_MISSING", "canonical obliko"), semanticTags:Object.freeze(sorted(data.semanticTags || input.semanticTags)), allowedInteractions:Object.freeze(sorted(data.allowedInteractions || input.allowedInteractions)), allowedValues:Object.freeze(asArray(data.allowedValues).map(function (value) { return Object.freeze({ id:boundedText(value.id, 80, "OPTION_ID_MISSING", "option ID"), label:boundedText(value.label, 120, "OPTION_LABEL_MISSING", "option label") }); })) }),
      validation:Object.freeze({ required:Boolean(validation.required), rule:assertText(validation.rule || input.validation, "VALIDATION_RULE_MISSING", "validacijo"), conditionalRules:Object.freeze(asArray(validation.conditionalRules).map(function (rule) { return Object.freeze({ relationId:assertText(rule.relationId, "RELATION_ID_MISSING", "relation ID"), sourceId:assertText(rule.sourceId, "RELATION_SOURCE_MISSING", "relation source"), values:Object.freeze(unique(rule.values)), effect:assertText(rule.effect, "RELATION_EFFECT_MISSING", "relation effect") }); })) }),
      ui:Object.freeze({ nativeColorTokens:NATIVE_COLOR_TOKENS, nativeTheme:assertText(ui.nativeTheme || input.nativeTheme, "NATIVE_THEME_MISSING", "native temo"), responsive:assertText(ui.responsive || input.responsive, "RESPONSIVE_MISSING", "responsive pravilo"), autoFit:text(ui.autoFit || "Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije."), accessibility:text(ui.accessibility || "Semantične kontrole, tipkovnica, vidno fokusno stanje in najmanj 44 px zadetne površine."), monotony:assertText(ui.monotony || input.monotony, "MONOTONY_RULE_MISSING", "pravilo vizualne raznolikosti") }),
      persistence:Object.freeze({ storage:text(persistence.storage || "existing-draft"), rule:assertText(persistence.rule || input.persistence, "PERSISTENCE_RULE_MISSING", "persistence pravilo"), hydrate:text(persistence.hydrate || "Obnovi canonical vrednost brez spremembe pomena."), hiddenRule:text(persistence.hiddenRule || "Skrito pogojno polje se ne zbira in ne prepisuje osnutka.") }),
      questionBinding:Object.freeze({ version:QUESTION_BINDING_VERSION, adaptive:Object.freeze(["question","label","help","placeholder","exampleLabel"]), locked:Object.freeze(["interfaceId","canonicalShape","allowedValueIds","required","conditionalRules","storage"]), question:assertText(questionBinding.question || input.mentalModel || intent.mentalModel, "QUESTION_BINDING_MISSING", "osnovno vprašanje") })
    };
    if (ui.nativeColorTokens && (asArray(ui.nativeColorTokens).length !== NATIVE_COLOR_TOKENS.length || asArray(ui.nativeColorTokens).some(function (token, index) { return token !== NATIVE_COLOR_TOKENS[index]; }))) fail("NATIVE_COLOR_OVERRIDE_BLOCKED", "NAZORJEVA: widget ne sme uvesti lastnega barvnega sistema.");
    definition.capability = capabilitySignature(definition);
    definition.context = Object.freeze({ version:CONTEXT_VERSION, interfaceId:interfaceValue, identity:definition.identity, intent:definition.intent, data:definition.data, validation:definition.validation, ui:definition.ui, persistence:definition.persistence, questionBinding:definition.questionBinding, capability:definition.capability });
    return Object.freeze(definition);
  }

  function setSimilarity(left, right) {
    var a = new Set(asArray(left)); var b = new Set(asArray(right));
    var intersection = Array.from(a).filter(function (value) { return b.has(value); }).length;
    var union = new Set(Array.from(a).concat(Array.from(b))).size;
    return union ? intersection / union : 0;
  }

  function resolveCollision(candidateInput, existingInputs) {
    var candidate = candidateInput.capability ? candidateInput : materializeWidgetDefinition(candidateInput);
    var ranked = asArray(existingInputs).map(function (item) {
      var existing = item.capability ? item : materializeWidgetDefinition(item);
      var exact = candidate.capability.key === existing.capability.key;
      var sameShape = candidate.capability.scope === existing.capability.scope && candidate.capability.canonicalShape === existing.capability.canonicalShape;
      var semanticScore = setSimilarity(candidate.capability.semanticTags, existing.capability.semanticTags);
      var interactionScore = setSimilarity(candidate.capability.interactions, existing.capability.interactions);
      var bothInteractionless = !candidate.capability.interactions.length && !existing.capability.interactions.length;
      var classification = exact ? "EXACT_DUPLICATE" : sameShape && semanticScore >= 0.5 && (interactionScore > 0 || bothInteractionless) ? "FUNCTIONAL_OVERLAP" : sameShape && semanticScore > 0 && text(candidateInput.distinctDataBenefit) ? "COMPLEMENTARY_VARIANT" : "INCOMPATIBLE";
      var score = (exact ? 4 : 0) + (sameShape ? 2 : 0) + semanticScore + interactionScore;
      return { existing:existing, classification:classification, score:score, semanticScore:semanticScore, interactionScore:interactionScore };
    }).sort(function (a,b) { return b.score - a.score; });
    var best = ranked[0] || null;
    var code = best ? best.classification : "NO_COLLISION";
    var blocking = BLOCKING_COLLISIONS.includes(code);
    return Object.freeze({ accepted:!blocking, code:code, blocking:blocking, matchedWidgetId:best && best.existing.id || null,
      reason:code === "EXACT_DUPLICATE" ? "Kandidat ima enak capability podpis kot obstoječi widget." : code === "FUNCTIONAL_OVERLAP" ? "Kandidat zajema isti canonical podatek z isto semantično in interakcijsko zmožnostjo." : code === "COMPLEMENTARY_VARIANT" ? "Različica je dovoljena samo zaradi izrecno dokazljive dodatne podatkovne koristi." : "Ni zaznane blokirne capability kolizije.",
      comparisons:Object.freeze(ranked.map(function (row) { return Object.freeze({ widgetId:row.existing.id, classification:row.classification, score:row.score, semanticScore:row.semanticScore, interactionScore:row.interactionScore }); })) });
  }

  function resolveInteraction(input) {
    input = input || {};
    var dataType = text(input.dataType || "string");
    var options = asArray(input.options);
    var optionCount = options.length;
    var longest = options.reduce(function (max, option) { return Math.max(max, text(option && (option.label || option)).length); }, 0);
    var viewport = Math.max(240, Number(input.viewportWidth) || 390);
    var mobile = viewport < 600;
    var multi = Boolean(input.multiSelect);
    var composite = Boolean(input.composite) || Number(input.fieldCount) > 1 || dataType === "structured-object";
    var result;
    if (composite) result = { interaction:"composite", presentation:"composite-card", code:"COMPOSITE_RELATED_FIELDS" };
    else if (["number","money","date","datetime","duration","file","string-list","long-text","short-text"].includes(dataType) && !optionCount) {
      var map = { number:"typed-number", money:"money", date:"date", datetime:"schedule", duration:"duration", file:"document-upload", "string-list":"list-builder", "long-text":"long-text", "short-text":"short-text" };
      result = { interaction:map[dataType] || "short-text", presentation:"typed-input", code:"TYPED_CANONICAL_VALUE" };
    } else if (input.requiresNativeSelect || input.accessibilityMode === "native-select") result = { interaction:"dropdown", presentation:"native-dropdown", code:"ACCESSIBILITY_NATIVE_SELECT" };
    else if (multi) {
      result = optionCount <= 6 && longest <= (mobile ? 28 : 42) ? { interaction:"choice-list", presentation:"clickable-cards", code:"MULTI_VISIBLE_CHOICES" } : { interaction:"choice-list", presentation:"scroll-list", code:"MULTI_SCROLL_PRESERVES_CONTEXT" };
    } else if (optionCount <= 3 && longest <= (mobile ? 18 : 26)) result = { interaction:"choice-segments", presentation:"segments", code:"FEW_SHORT_EXCLUSIVE_OPTIONS" };
    else if (optionCount <= (mobile ? 4 : 6) && longest <= (mobile ? 24 : 34)) result = { interaction:"choice-grid", presentation:"clickable-grid", code:"COMPACT_SCANNABLE_OPTIONS" };
    else if (optionCount <= 7 || longest > 36) result = { interaction:"choice-list", presentation:optionCount > (mobile ? 4 : 6) ? "scroll-list" : "clickable-cards", code:"LONG_OR_MEDIUM_OPTION_SET" };
    else result = { interaction:"dropdown", presentation:"searchable-dropdown", code:"LARGE_OPTION_SET" };
    return Object.freeze(Object.assign(result, { mobile:mobile, optionCount:optionCount, longestLabel:longest, selectionMode:multi ? "multiple" : "single", reason:"Odločitev temelji na canonical tipu, številu in dolžini možnosti, selection načinu, viewportu in dostopnosti." }));
  }

  function bindQuestion(baseContext, binding) {
    binding = binding || {};
    if (!baseContext || !baseContext.interfaceId) fail("BASE_CONTEXT_MISSING", "NAZORJEVA: QuestionBinding potrebuje osnovni context.");
    var forbidden = ["interfaceId","canonicalShape","allowedValueIds","required","conditionalRules","storage"].filter(function (key) { return Object.prototype.hasOwnProperty.call(binding, key); });
    if (forbidden.length) return Object.freeze({ accepted:false, code:"QUESTION_BINDING_LOCKED_OVERRIDE", forbidden:Object.freeze(forbidden), context:baseContext });
    var allowedIds = asArray(baseContext.canonical && baseContext.canonical.allowedValues || baseContext.data && baseContext.data.allowedValues).map(function (item) { return text(item.id); });
    var suppliedOptions = asArray(binding.options);
    if (suppliedOptions.length && (suppliedOptions.length !== allowedIds.length || suppliedOptions.some(function (item) { return !allowedIds.includes(text(item.id)); }))) return Object.freeze({ accepted:false, code:"QUESTION_BINDING_OPTION_IDS_CHANGED", context:baseContext });
    var adaptive = { question:text(binding.question || baseContext.intent && baseContext.intent.question || baseContext.questionBinding && baseContext.questionBinding.question), label:text(binding.label), help:text(binding.help), placeholder:text(binding.placeholder), exampleLabel:text(binding.exampleLabel) };
    if (adaptive.question.length > 240 || adaptive.label.length > 120 || adaptive.help.length > 500 || adaptive.placeholder.length > 160 || adaptive.exampleLabel.length > 160 || suppliedOptions.some(function (item) { return text(item.label).length > 120; })) return Object.freeze({ accepted:false, code:"QUESTION_BINDING_VALUE_TOO_LONG", context:baseContext });
    return Object.freeze({ accepted:true, code:"QUESTION_BINDING_ACCEPTED", binding:Object.freeze({ version:QUESTION_BINDING_VERSION, interfaceId:baseContext.interfaceId, question:adaptive.question, label:adaptive.label, help:adaptive.help, placeholder:adaptive.placeholder, exampleLabel:adaptive.exampleLabel, options:Object.freeze(suppliedOptions.map(function (item) { return Object.freeze({ id:text(item.id), label:text(item.label) }); })) }), locked:Object.freeze({ canonicalShape:baseContext.canonical && baseContext.canonical.type || baseContext.data && baseContext.data.canonicalShape, required:Boolean(baseContext.validation && baseContext.validation.required), storage:baseContext.persistence && baseContext.persistence.storage }) });
  }

  function validateContext(context) {
    if (!context || typeof context !== "object") return Object.freeze({ ok:false, code:"CONTEXT_MISSING" });
    if (context.version !== CONTEXT_VERSION) return Object.freeze({ ok:false, code:"CONTEXT_VERSION_STALE", expected:CONTEXT_VERSION, actual:context.version || null });
    var required = ["interfaceId","identity","intent","validation","ui","persistence"];
    var missing = required.filter(function (key) { return !context[key]; });
    if (missing.length) return Object.freeze({ ok:false, code:"CONTEXT_INCOMPLETE", missing:Object.freeze(missing) });
    if (!text(context.persistence.storage || context.persistence.rule)) return Object.freeze({ ok:false, code:"PERSISTENCE_CONTRACT_MISSING" });
    if (context.ui.nativeColorTokens && (context.ui.nativeColorTokens.length !== NATIVE_COLOR_TOKENS.length || context.ui.nativeColorTokens.some(function (token, index) { return token !== NATIVE_COLOR_TOKENS[index]; }))) return Object.freeze({ ok:false, code:"NATIVE_COLOR_INVALID" });
    return Object.freeze({ ok:true, code:"CONTEXT_VALID" });
  }

  function transition(record, nextState, evidence) {
    record = record || {}; evidence = evidence || {};
    var current = text(record.lifecycleState || record.status || "draft");
    var next = text(nextState);
    if (!LIFECYCLE[current] || !LIFECYCLE[current].includes(next)) return Object.freeze({ accepted:false, code:"INVALID_LIFECYCLE_TRANSITION", from:current, to:next });
    if (next === "approved") {
      if (current !== "ready_for_approval") return Object.freeze({ accepted:false, code:"TEST_BYPASS_BLOCKED", from:current, to:next });
      if (evidence.userApproved !== true || text(evidence.approvedWidgetId) !== text(record.id)) return Object.freeze({ accepted:false, code:"EXPLICIT_APPROVAL_REQUIRED", from:current, to:next });
      if (!text(evidence.approvalEvidence) || !text(evidence.testEvidence)) return Object.freeze({ accepted:false, code:"PROMOTION_EVIDENCE_MISSING", from:current, to:next });
    }
    return Object.freeze({ accepted:true, code:next === "approved" ? "PROMOTION_AUTHORIZED" : "TRANSITION_ACCEPTED", from:current, to:next, record:Object.freeze(Object.assign({}, record, { lifecycleState:next, status:next === "approved" ? "approved" : next === "rejected" ? "rejected" : "test" })) });
  }

  function admitCandidate(candidateInput, approvedDefinitions, testDefinitions) {
    var candidate = materializeWidgetDefinition(Object.assign({}, candidateInput, { status:"test", identity:Object.assign({}, candidateInput && candidateInput.identity, { status:"test", origin:"NAZORJEVA-TEST" }) }));
    var all = asArray(approvedDefinitions).concat(asArray(testDefinitions));
    if (all.some(function (item) { return text(item.id) === candidate.id; })) return Object.freeze({ accepted:false, code:"WIDGET_ID_ALREADY_EXISTS", candidate:candidate });
    var collision = resolveCollision(candidateInput, all);
    if (collision.blocking) return Object.freeze({ accepted:false, code:collision.code, collision:collision, candidate:candidate });
    return Object.freeze({ accepted:true, code:"ADMITTED_TO_TEST", lifecycleState:"test", candidate:candidate, collision:collision });
  }

  function planPromotion(candidate, evidence, snapshot) {
    var auth = transition(Object.assign({}, candidate, { lifecycleState:candidate && candidate.lifecycleState || "ready_for_approval" }), "approved", evidence);
    if (!auth.accepted) return auth;
    snapshot = snapshot || {};
    var approvedIds = unique(snapshot.approvedIds);
    var testIds = unique(snapshot.testIds);
    if (!testIds.includes(candidate.id)) return Object.freeze({ accepted:false, code:"CANDIDATE_NOT_IN_TEST", candidateId:candidate.id });
    if (approvedIds.includes(candidate.id)) return Object.freeze({ accepted:false, code:"ALREADY_APPROVED", candidateId:candidate.id });
    return Object.freeze({ accepted:true, code:"PROMOTION_PLAN_READY", candidateId:candidate.id, approvalEvidence:text(evidence.approvalEvidence),
      preconditions:Object.freeze(["candidate-in-test","renderer-implementation-present","deep-context-valid","no-blocking-collision","tests-fresh","explicit-user-approval"]),
      transaction:Object.freeze({ removeFromTest:true, appendToApproved:true, updateApprovedTemplateIds:true, materializeContract:true, regenerateDocs:true, runTests:true, rollbackOnFailure:true }),
      nextSnapshot:Object.freeze({ approvedIds:Object.freeze(approvedIds.concat(candidate.id)), testIds:Object.freeze(testIds.filter(function (id) { return id !== candidate.id; })) }) });
  }

  function buildLunaManifest(definitions) {
    var rows = asArray(definitions).map(function (input) {
      var item = input.context ? input : materializeWidgetDefinition(input);
      var context = item.context;
      return Object.freeze({ widgetId:item.id, interfaceId:item.interfaceId, status:item.status, purpose:context.intent.purpose, mentalModel:context.intent.mentalModel, suitable:context.intent.suitable, unsuitable:context.intent.unsuitable, examples:context.intent.examples, scope:context.data.scope, canonicalShape:context.data.canonicalShape, semanticTags:context.data.semanticTags, allowedInteractions:context.data.allowedInteractions, validation:context.validation, persistence:context.persistence, questionBinding:context.questionBinding });
    });
    return Object.freeze({ version:LUNA_MANIFEST_VERSION, contextVersion:CONTEXT_VERSION, authority:"proposal-only", decisionBoundary:"Deterministični NAZORJEVA engine potrdi, preoblikuje ali zavrne vsak predlog; Luna ne spreminja canonical pomena.", widgets:Object.freeze(rows) });
  }

  function evaluateLunaProposal(proposal, target, approvedById) {
    proposal = proposal || {}; target = target || {}; approvedById = approvedById || {};
    if (!text(proposal.widgetId)) return Object.freeze({ accepted:false, code:"LUNA_WIDGET_ID_MISSING" });
    var widget = approvedById[proposal.widgetId];
    if (!widget || widget.status !== "approved") return Object.freeze({ accepted:false, code:"LUNA_WIDGET_NOT_APPROVED", widgetId:proposal.widgetId });
    if (!asArray(proposal.evidenceSpans).length || asArray(proposal.evidenceSpans).some(function (span) { return !text(span); })) return Object.freeze({ accepted:false, code:"LUNA_EVIDENCE_REQUIRED", widgetId:proposal.widgetId });
    var context = widget.context || widget;
    var data = context.data || widget.data || {};
    if (text(target.scope) && text(target.scope) !== text(data.scope)) return Object.freeze({ accepted:false, code:"LUNA_SCOPE_MISMATCH", widgetId:proposal.widgetId });
    if (text(target.canonicalShape) && text(target.canonicalShape) !== text(data.canonicalShape)) return Object.freeze({ accepted:false, code:"LUNA_CANONICAL_SHAPE_MISMATCH", widgetId:proposal.widgetId });
    var targetTags = unique(target.semanticTags);
    if (targetTags.length && !targetTags.some(function (tag) { return asArray(data.semanticTags).includes(tag); })) return Object.freeze({ accepted:false, code:"LUNA_SEMANTIC_EVIDENCE_MISMATCH", widgetId:proposal.widgetId });
    var resolved = target.interaction ? Object.freeze({ interaction:target.interaction, presentation:"host-requested", code:"HOST_INTERACTION", reason:"Gostiteljski interaction je vhod, odobren contract pa ga mora potrditi." }) : resolveInteraction(target.interactionInput || target);
    var allowed = asArray(data.allowedInteractions);
    if (allowed.length && !allowed.includes(resolved.interaction) && !allowed.includes(proposal.interaction)) return Object.freeze({ accepted:false, code:"LUNA_INTERACTION_REJECTED", widgetId:proposal.widgetId, deterministicInteraction:resolved });
    return Object.freeze({ accepted:true, code:proposal.interaction && proposal.interaction !== resolved.interaction ? "LUNA_PROPOSAL_TRANSFORMED" : "LUNA_PROPOSAL_CONFIRMED", widgetId:proposal.widgetId, interaction:allowed.includes(resolved.interaction) ? resolved.interaction : proposal.interaction, deterministicInteraction:resolved, evidenceSpans:Object.freeze(proposal.evidenceSpans.slice()) });
  }

  return Object.freeze({
    version:VERSION, contextVersion:CONTEXT_VERSION, definitionVersion:DEFINITION_VERSION, capabilityVersion:CAPABILITY_VERSION,
    questionBindingVersion:QUESTION_BINDING_VERSION, lunaManifestVersion:LUNA_MANIFEST_VERSION, lifecycle:LIFECYCLE,
    idPatterns:ID_PATTERNS, nativeColorTokens:NATIVE_COLOR_TOKENS, interfaceId:interfaceId, stableIds:stableIds,
    validateIdRegistry:validateIdRegistry, capabilitySignature:capabilitySignature, materializeWidgetDefinition:materializeWidgetDefinition,
    resolveCollision:resolveCollision, resolveInteraction:resolveInteraction, bindQuestion:bindQuestion, validateContext:validateContext, transition:transition,
    admitCandidate:admitCandidate, planPromotion:planPromotion, buildLunaManifest:buildLunaManifest, evaluateLunaProposal:evaluateLunaProposal
  });
});
