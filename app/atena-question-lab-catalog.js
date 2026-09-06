(function(root,factory){
  var api;
  if(typeof module==="object"&&module.exports)api=factory(require("./atena-card-templates"),require("./atena-card-schema"),require("./atena-card-renderer"),require("./svetovalec-storitve-engine"));
  else api=factory(root&&root.UJAtenaCardTemplates,root&&root.UJAtenaCardSchema,root&&root.UJAtenaCardRenderer,root&&root.UJSvetovalecStoritveEngine);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.UJAtenaQuestionLabCatalog=api;
})(typeof window!=="undefined"?window:null,function(templates,schema,renderer,services){
  "use strict";
  if(!templates||!schema||!renderer)throw new Error("Atena question lab catalog: manjkajo kanonični viri kartic.");
  var nazorjeva=Object.freeze(templates.templates.map(function(item){return Object.freeze(Object.assign({},item,{sourceType:"nazorjeva-template",sourceCategory:"nazorjeva",sourceLabel:"Nazorjeva zasnova",templateId:item.id}));}));
  var historyForms=templates.categories&&templates.categories["1.0"]&&templates.categories["1.0"].records||[];
  var goalForms=templates.categories&&templates.categories["2.0"]&&templates.categories["2.0"].records||[];
  var formCards=Object.freeze(historyForms.concat(goalForms).map(function(record,index){var template=templates.templates.find(function(item){return item.id===record.templateId;});return Object.freeze({
    id:"debtor-form:"+record.category+":"+record.id,number:nazorjeva.length+index+1,title:record.title,question:record.question||record.description||record.title,
    coverage:(record.family==="history-form"?"Zgodovina neplačnika":record.family==="legal-outcome-father"?"Pravni cilj neplačnika":"Cilj neplačnika")+" · "+(template&&template.title||record.templateId),approved:true,
    sourceType:"debtor-form-card",sourceCategory:"debtor",sourceLabel:record.family==="history-form"?"Atena · Zgodovina":"Atena · Cilji",cardId:record.category+":"+record.id,templateId:record.templateId,record:record,template:template
  });}));
  function serviceTheme(flow){var service=flow!=="ponudba"&&services&&services.get?services.get(flow):null,accent=service&&service.accent||"#e49a10",tint=service&&service.tint||"#fff8e9",hex=accent.replace("#","");return Object.freeze({accent:accent,tint:tint,rgb:[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)].join(",")});}
  var atenaCards=Object.freeze(schema.catalog.map(function(card,index){var presentation=card.questionWidget&&card.questionWidget.presentation||{},service=serviceTheme(card.flow);return Object.freeze({
    id:"atena-card:"+card.id,number:nazorjeva.length+formCards.length+index+1,title:card.title,coverage:(card.flowLabel||card.flow)+" · "+(card.description||card.question),question:card.question,
    approved:true,sourceType:"atena-card",sourceCategory:"atena",sourceLabel:"Atenina kartica",cardId:card.id,templateId:presentation.templateId||"besedilni-vnos",theme:presentation.theme||"teal",rgb:presentation.rgb||"41,163,162",serviceTheme:service,card:card
  });}));
  var all=Object.freeze(nazorjeva.concat(formCards,atenaCards));
  function renderPreview(choice){if(choice.sourceType==="nazorjeva-template")return templates.renderTemplate(choice);if(choice.sourceType==="debtor-form-card"){var base=choice.template||templates.templates[0],preview=Object.assign({},base,{id:choice.id,title:choice.title,question:choice.question,coverage:choice.coverage});return '<span class="aql-debtor-card-context">'+templates.renderTemplate(preview)+'</span>';}var card=choice.card,content=(card.fields||[]).length?renderer.moduleContentHtml(card,card.fields,{}):renderer.specialModuleContentHtml(card,{completedCount:0,totalModules:27,answerCount:0}),siblings=schema.catalog.filter(function(item){return item.flow===card.flow&&item.areaCode===card.areaCode;}),step=Math.max(1,siblings.findIndex(function(item){return item.id===card.id;})+1),theme=choice.serviceTheme,shell=renderer.questionShellHtml({interfaceId:card.interfaceId,questionWidget:card.questionWidget,ariaLabel:card.question,iconHtml:renderer.moduleIconHtml(card.moduleCode),title:card.title,description:card.description,question:card.question,step:step,total:siblings.length||1,contentHtml:content,showClose:true});return '<span class="aql-app-card-context stran--storitev stran--svetovalec is-ponudba-mode" data-storitev-tema="'+card.flow+'" style="--svetovalec-storitev-barva:'+theme.accent+';--svetovalec-storitev-ozadje:'+theme.tint+';--svetovalec-storitev-rgb:'+theme.rgb+'"><span class="aql-app-card-form ponudba-obrazec" data-atena-question-shell="true"><span class="ponudba-obrazec__polja">'+shell+'</span></span></span>';}
  return Object.freeze({version:"atena-question-lab-catalog-v4",nazorjeva:nazorjeva,formCards:formCards,atenaCards:atenaCards,all:all,counts:Object.freeze({nazorjeva:nazorjeva.length,formCards:formCards.length,atenaCards:atenaCards.length,all:all.length}),renderPreview:renderPreview});
});
