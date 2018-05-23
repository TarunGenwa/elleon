let util = require('./util');
const graphqlFields                               = require('graphql-fields');
const pluralize                                   = require('pluralize');

const loadAttributes = module.exports.loadAttributes = (model) => {
    let attrs = model.attributes;
    let formatted = {};

    let remove = [];
    if(model.removeFromGraphQLSchema) remove = model.removeFromGraphQLSchema;


    for(let name in attrs){
        let attr = attrs[name];

        let g_type = util.getType(attr.type.toString());

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
        if(attr.graphql === false) formattedAttr.include = false;

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
}

const loadAssociations = module.exports.loadAssociations = (model) => {
    let formatted = {};
    let assocs = model.associations;
    for( let assocName in assocs){
        let assoc = assocs[assocName];

        let referenceName = assoc.target.name;
        let type = assoc.associationType.toString();

        let relation = 'one';
        if(type.includes('Many')) relation = 'many';


        let formattedAssoc = {
            associationName:assocName,
            referenceName:referenceName,
            associationType:relation,
            association:assoc,
        };

        formatted[assocName] = formattedAssoc;
    }

    return formatted;
}

const loadOptions = module.exports.loadOptions = (model) => {
    return {};
}

const createSubscriptions = module.exports.createSubscriptions = async ( instance, model, subname, hookname ) => {

  let model_name = util.capitalizeFirstLetter(model.name);
  let type_name = (instance.capitalize) ? model_name : model.name;
  let subscriptionName = `${subname}${model_name}`;
  let event_name = `${model_name}${subname}`;
  let pubsub = util.getPubsub(instance);

  let seqModel = model.model;
  if('afterBulkUpdate'){
    seqModel.hook(hookname, (options) => {
      let data = {[subscriptionName]:{id:1, name:'Apple'}};//todo needs to be changed
      console.log(data);
      pubsub.publish(event_name, data);
    });
  }else{
    seqModel.hook(hookname, (instance, options) => {
      let data = {[subscriptionName]:instance.toJSON()};
      console.log(data);
      pubsub.publish(event_name, data);
    });
  }


  if(hookname == 'afterSave' || hookname == 'afterUpdate'){
    instance.subscriptions += util.createRow(subscriptionName, type_name, '(id: Int)');

    instance.Subscription[subscriptionName] = {
      subscribe: withFilter(
        () => pubsub.asyncIterator(event_name),
        (payload, args) => {
          if(_.isEmpty(args)) return true;
          return payload[subscriptionName].id === args.id
        },
      )
    };
  }else{
    instance.subscriptions += util.createRow(subscriptionName, type_name);
    instance.Subscription[subscriptionName] = {
      subscribe: () => pubsub.asyncIterator(event_name)
    };
  }
};

const addGetSingle = module.exports.addGetSingle = async (instance, model) => {
  let actualModel = model.model;
  let model_name = util.capitalizeFirstLetter(model.name);
  let query_name = `get${model_name}`;

  if (!instance.Query[query_name]) {

    instance.queries += instance.makeRowStr(query_name, model);

    instance.Query[query_name] = async (parent, args, {}, info) => {

      let requested = graphqlFields(info);

      let includes = util.getIncludes(requested, model, instance.models);

      let data;
      try {
        data = await actualModel.findOne({where: args.where, include: includes});
      } catch (err) {
        console.log('err', err);
        return false
      }

      return util.getResolverValues(requested, data);
    }
  }
};

const addGetAll = module.exports.addGetAll = async (instance, model) => {
  let actualModel = model.model;
  let model_name = util.capitalizeFirstLetter(model.name);

  let p_model_name = pluralize.plural(model_name);
  let all_query_name = `get${p_model_name}`;

  if (!instance.Query[all_query_name]) {

    instance.queries += instance.makeRowStr(all_query_name, model, {association: 'many', limit:true});

    instance.Query[all_query_name] = async (parent, args, {}, info) => {

      let query = Object.assign({}, args);

      let model_params = {};
      if(query.limit)  {
        model_params.limit = args.limit;
        delete query.limit;
      }
      if(query.offset) {
        model_params.offset = args.offset;
        delete query.offset;
      }

      let requested = graphqlFields(info);

      let includes = util.getIncludes(requested, model, instance.models);

      model_params.where   = args.where;
      model_params.include = includes;

      let data;

      try {
        data = await actualModel.findAll(model_params);
      } catch (err) {
        return false
      }

      return util.getResolverValues(requested, data);
    }

  }
};
