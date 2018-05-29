let util = require('../util');
const graphqlFields                               = require('graphql-fields');
const pluralize                                   = require('pluralize');
const {SequelizeModel} = require('../models/sequelize.model');
const {Attribute} = require('../attributes/class');

const AbstractAllModels = module.exports.AbstractAllModels = (models) => {
    let fmodels = {}
    for(let key in models){
        let model = models[key];
        let modelName = model.name
        if(!modelName) continue;

        if(fmodels[model.name]) throw `duplicate model name: ${model.name}`;

        let associations = loadAssociations(model);
        let properties   = loadProperties(model);
        let options      = loadOptions(model);

        let attributes = _.merge(properties, associations);
        let info = {
            type                :'sequelize',
            name                : model.name,
            objectKey           : key,
            attributes          : attributes,
            model               : model,
            options             : options,
        }

        fmodels[modelName] = new SequelizeModel(info)
    }

    return fmodels;
};

const loadProperties = module.exports.loadAttributes = (model) => {
    let props = model.attributes;
    let formatted = {};

    let remove = [];
    if(model.removeFromGraphQLSchema) remove = model.removeFromGraphQLSchema;

    for(let name in props){
        let prop = props[name];

        let g_type = util.getType(prop.type.toString());

        let formattedProp = {
            name: name,
            schemaType:g_type,
            relation:'one',
            actual:prop,
            type:'property',
            parentType:'sequelize',
            paramOptions:{
                getSingle:true,
            }
        };

        if(remove.includes(name)){
            formattedProp.include        = false;
            formattedProp.paramOptions.getSingle = false;
        }
        if(attr.graphql === false) formattedProp.include = false;

        formatted[name] = new Attribute(formattedProp);
    }

    // let additional = model.addToGraphQLSchema;

    // if(additional){
    //     for(let name in additional){
    //         if(formatted[name]) throw `Attribute ${name} already exists on sequleize model: ${model.name}`;
    //
    //         let attr = additional[name];
    //         let g_type = util.getType(attr.type);
    //
    //         let formattedAttr = {
    //             name: name,
    //             queryParameter: true,
    //             type: g_type,
    //             include: true,
    //             attribute: attr,
    //         };
    //
    //         if(attr.queryParameter === false) formattedAttr.queryParameter = false;
    //
    //         formatted[name] = formattedAttr;
    //     }
    // }

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
            name:assocName,
            schemaType:referenceName,
            relation:relation,
            actual:assoc,
            type:'association'
        };

        formatted[assocName] = new Attribute(formattedAssoc);
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

    if (!instance.Query[model.queryGetSingleName]) {

        instance.queries += instance.makeRowStr(model.queryGetSingleName, model);

        instance.Query[model.queryGetSingleName] = async (parent, args, {}, info) => {

            let requested = graphqlFields(info);

            let includes = getIncludes(requested, model, instance.models);

            let data;
            try {
                data = await actualModel.findOne({where: args.where, include: includes});
            } catch (err) {
                console.log('err', err);
                return false
            }

            return getResolverValues(requested, data);
        }
    }
};

const addGetAll = module.exports.addGetAll = async (instance, model) => {
    let actualModel = model.model;

    if (!instance.Query[model.queryGetAllName]) {

        instance.queries += instance.queryGetAllName(model.queryAllName, model, {association: 'many', limit:true});

        instance.Query[model.queryGetAllName] = async (parent, args, {}, info) => {

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

            let includes = getIncludes(requested, model, instance.models);

            model_params.where   = args.where;
            model_params.include = includes;

            let data;

            try {
                data = await actualModel.findAll(model_params);
            } catch (err) {
                return false
            }

            return getResolverValues(requested, data);
        }

    }
};


const getIncludes = module.exports.getIncludes = (requested, model, models) => {

    let includes = [];
    for(let i in requested){
        let value = requested[i];

        if(_.isEmpty(value)) continue;

        let attr = this.attributes[i];
        if(!attr || attr.type == 'property') continue;

        let assoc_model = models[attr.schemaType];

        let single = {
            model:assoc_model.model,
            as:i,
        };

        let other_include = this.getIncludes(value, assoc_model, models);
        if(other_include.length>0) single.include = other_include;

        includes.push(single)
    }

    return includes;
};

const testLoop = (requested, data) => {
    let return_data = _.cloneDeep(data);

    for(let key in requested) {
        let value = requested[key];
        if (_.isEmpty(value)) continue;

        return_data[key] = (nargs) => {
            let sendValues = data[key];

            let query = nargs.where;

            if(typeof sendValues.filter === 'function'){
                if(!_.isEmpty(query)){
                    sendValues = sendValues.filter(obj=>{
                        return _.isMatch(obj, query);
                });
                }

                if(nargs.offset){
                    sendValues = sendValues.slice(nargs.offset, sendValues.length)
                }
                if(nargs.limit){
                    sendValues = sendValues.slice(0, nargs.limit)
                }

            }else {
                if (!_.isMatch(sendValues, query)) {
                    return null;
                }
            }

            for(let i in value){
                let nested_value = value[i];
                if (_.isEmpty(nested_value)) continue;
                sendValues = getResolverValues(value, sendValues);
            }

            return sendValues;
        };
    }

    return return_data;
};

const getResolverValues = module.exports.getResolverValues = (requested, data) => {
    if(_.isArray(data)){
        data = data.map(d=>{
            return testLoop(requested, d);
    })
    }else if(_.isObject(data)){
        data = testLoop(requested, data)
    }
    return data;
};
