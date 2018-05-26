let util = require('./util');
const graphqlFields                               = require('graphql-fields');
const pluralize                                   = require('pluralize');

const getNestedModelName = (attr, model) => {
  let nameInfo = attr.path.split('.');
  if(!model.modelName){
    // console.log('test', model)
    return
  }
  let parentModelName = util.capitalizeFirstLetter(model.modelName);
  return  `${parentModelName}${util.capitalizeFirstLetter(nameInfo[0])}`;
};

const makeNestedModel = (instance, attr, model) => {
  let nameInfo = attr.path.split('.');
  let modelName = getNestedModelName(attr, model);
  let attrName  = nameInfo[1];

  let CapModelName = modelName;

  // console.log('modelname', modelName);
  if(!instance.models[modelName]){
    instance.models[modelName] = {
      type            :'mongoose',
      name            : modelName,
      objectKey       : attrName,
      associations    : {},
      attributes      : {},
      model           : null,//this is a nested model
      options         : {
        nested:true,
        type: 'regular',
      },
      queryInputName  : `${CapModelName}WhereInput`,
      getSingle       : false,
      getAll          : false,
    }
  }else if(instance.models[modelName].type !== 'mongoose'){
    throw new Error(`Nested attribute "${modelName}" conflicts in schema`)
  }

  if(!instance.models[modelName].attributes[attrName]){
    instance.models[modelName].attributes[attrName] = formatAttribute(attr, [], {queryParameter:true, include:true})
  }

  if(attr.instance == 'Array' || attr.instance == "Embedded"){
    if(attr.schema){
      // let attributes = loadAttributes(instance, attr);

      console.log('extrsinisc', model.modelName, modelName)
    }else{
      console.log('intrinsic', model.modelName, modelName, attr.caster.instance)
    }

  }

  return instance.models[modelName];
};

const formatAttribute = (attr, remove, settings) => {
  let defaults = {
    queryParameter: true,
    include: true
  };
  settings = Object.assign({}, defaults, settings);

  let name = attr.path;
  let g_type = util.getType(attr.instance.toString());

  let options = attr.options;

  let sudoAttr = name.split('.');
  if(sudoAttr.length>1){
    name = sudoAttr[1];
  }

  let formattedAttr = {
    name            : name,
    queryParameter  : settings.queryParameter,
    type            : g_type,
    include         : settings.include,
    attribute       : attr,
  };

  if(remove.includes(name)){
    formattedAttr.include        = false;
    formattedAttr.queryParameter = false;
  }
  if(options.graphql === false) formattedAttr.include = false;

  return formattedAttr;
};

const loadAttributes = module.exports.loadAttributes = (instance, model) => {
  let attrs = model.schema.paths;
  let formatted = {};
  let remove = [];
  if(model.removeFromGraphQLSchema) remove = model.removeFromGraphQLSchema;

  for(let name in attrs){
    let attr = attrs[name];

    let sudoAttr = name.split('.');

    if(sudoAttr.length>1){
      // console.log('model', model.modelName, 'attr' ,attr.path);
      let assocModel = makeNestedModel(instance, attr, model);
      continue;
    }

    if(attr.instance == 'Embedded' || attr.instance == 'Array'){
      if(name === 'testMongoose' || name === 'workbooks'){
        console.log('test', name, attr.instance, attr.casterConstructor);
      }
      let assocModel = makeNestedModel(instance, attr, model);
      continue;
    }

    let formattedAttr = formatAttribute(attr, remove);

    formatted[name] = formattedAttr;
  }

  let additional = model.addToGraphQLSchema;

  if(additional){
    for(let name in additional){
      if(formatted[name]) throw `Attribute ${name} already exists on sequleize model: ${model.name}`;

      let attr = additional[name];

      let g_type = util.getType(attr.type);

      let formattedAttr = {
        name: name,
        queryParameter: true,
        type: g_type,
        include: true,
        attribute: attr,
      };

      if(attr.queryParameter === false) formattedAttr.queryParameter = false;

      formatted[name] = formattedAttr;
    }
  }

  return formatted;
};

const formatAssociation = (assoc) => {

};
const loadAssociations = module.exports.loadAssociations = (instance, model) => {
  let attrs = model.schema.paths;
  let formatted = {};

  for(let name in attrs){
    let attr = attrs[name];
    let sudoAttr = name.split('.');
    if(sudoAttr.length<=1) continue;
    // associations
    let associationName = sudoAttr[0];
    let referenceModelName = getNestedModelName(attr, model);
    if(formatted[associationName]) continue;
    formatted[associationName] = {
      name:associationName,
      associationType:'one',
      referenceName:referenceModelName,
    }
  }

  for(let name in attrs){
    let attr = attrs[name];

    if(attr.instance === 'Embedded' || attr.instance === 'Array'){

      let referenceModelName = getNestedModelName(attr, model);

      let associationName = name;
      let sudoAttr = name.split('.');
      if(sudoAttr.length>1) continue;

      if(formatted[associationName]) continue;

      let relation = 'one';
      if(attr.instance === 'Array') relation = 'many';

      formatted[associationName] = {
        name:associationName,
        associationType:relation,
        referenceName:referenceModelName,
      }

    }
  }

  return formatted;
};

const loadOptions = module.exports.loadOptions = (model) => {
  return {};
};

const addGetSingle = module.exports.addGetSingle = async (instance, model) => {
  if(!model.getSingle) return;
  let actualModel = model.model;

  if (!instance.Query[model.querySingleName]) {

    instance.queries += instance.makeRowStr(model.querySingleName, model);

    instance.Query[model.querySingleName] = async (parent, args, {}, info) => {

      let requested = graphqlFields(info);
      let query = {};
      if(args.where) query = args.where;

      let data;
      try {
        data = await actualModel.findOne(query);
        console.log('test', data)
      }catch(err){
        return err;
      }

      if(!data) return {};

      console.log('test', data)
      return data.toJSON();
    }
  }
};

const addGetAll = module.exports.addGetAll = (instance, model) => {
  if(!model.getAll) return;
  return {};
};



