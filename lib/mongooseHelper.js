let util = require('./util');
const graphqlFields                               = require('graphql-fields');
const pluralize                                   = require('pluralize');


const loadAttributes = module.exports.loadAttributes = (model) => {
  let attrs = model.schema.paths;

  let formatted = {};

  let remove = [];
  if(model.removeFromGraphQLSchema) remove = model.removeFromGraphQLSchema;

  for(let name in attrs){
    let attr = attrs[name];

    let options = attr.options;

    let g_type = util.getType(attr.instance.toString());

    let sudoAttr = name.split('.');

    if(sudoAttr.length>1){
      console.log(sudoAttr)
      continue;
    }

    let formattedAttr = {
      name: name,
      queryParameter: true,
      type: g_type,
      include: true,
      attribute: attr,
    };

    if(remove.includes(name)){
      formattedAttr.include        = false;
      formattedAttr.queryParameter = false;
    }
    if(options.graphql === false) formattedAttr.include = false;

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


const loadAssociations = module.exports.loadAssociations = (model) => {

};

const loadOptions = module.exports.loadOptions = (model) => {
  return {};
};

const addGetSingle = module.exports.addGetSingle = async (instance, model) => {
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
      }catch(err){
        return err;
      }

      if(!data) return {};

      return data.toJSON();
    }
  }
};

const addGetAll = module.exports.addGetAll = (instance, model) => {
  return {};
};



