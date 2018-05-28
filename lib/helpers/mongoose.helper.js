const _ = require('lodash');
const pluralize                                   = require('pluralize');
const util = require('../util');

const {MongooseModel} = require('../models/mongoose.model');

const AbstractAllModels = module.exports.AbstractAllModels = (someModels) => {
    let models = someModels;

    let formatted_models = {};
    for(let key in models){
        let model = models[key];
        if(!model.modelName) continue;

        let tmodel = {
            obj:model.schema.obj,
            name:model.modelName,
            model:model,
        };

        getModelsFromModel(tmodel, formatted_models);//formats all the models and loads them into the variable formatted models
    }
    return formatted_models;
};

const formatModel = (tmodel) => {
    if(!tmodel.name) return;
    /*
    required
    .name

    optional
    .associations
    .attributes
    .model

     */
    let modelName           = tmodel.name;

    let fmodel = {
        type                :'mongoose',
        name                : modelName,
        model               : tmodel.model,
        associations        : tmodel.assosications,
        attributes          : tmodel.attributes,

        getSingle           : false,
        getAll              : false,

        mutationCreate      : false,
        mutationUpdate      : false,
        mutationDelete      : false
    };

    if(tmodel.model){
        fmodel.getSingle    = true;
        fmodel.getAll       = true;
        fmodel.mutationCreate       = true;
        fmodel.mutationUpdate       = true;
        fmodel.mutationDelete       = true;

    }

    let model = new MongooseModel(fmodel);
    return model;
}

const getName = (attrName, parentModelName) => {
    let capParent = util.capitalizeFirstLetter(parentModelName);
    let capAttr = util.capitalizeFirstLetter(attrName);
    return capParent+capAttr;
};
const analyseAttr = (attr, attrName, parentModelName) => {
    if(attr.type){
        let type = util.getType(attr.type.toString());
        return {kind:'attribute', value:attr, relation:'one', type:type}
    }else if(attr.obj){
        let type = getName(attrName, parentModelName);
        return {kind:'object', value:attr.obj, relation:'one', type:type}
    }else if(_.isArray(attr)){
        attr = attr[0];
        if(attr.type){
            let type = util.getType(attr.type.toString());
            return {kind:'attribute', value:attr, relation:'many', type:type}
        }else if(attr.obj){
            let type = getName(attrName, parentModelName);
            return {kind:'object', value:attr.obj, relation:'many', type:type}
        }else{
            let type = getName(attrName, parentModelName);
            return {kind:'object', value:attr, relation:'many', type:type}
        }
    }else{//instrinsic nested object
        let type = getName(attrName, parentModelName);
        return {kind:'object', value:attr, relation:'one', type:type}
    }

    return null
};

const getModelsFromModel = (tmodel, formatted_models) => {
    /*
    required tmodel
    .name
    .obj
     */

    let models = {};
    let new_models = {};
    let modelName = tmodel.name;
    let attrs = tmodel.obj;

    let attributes = {};
    let assosications = {};

    for (let name in attrs){
        let attr = attrs[name];
        let res = analyseAttr(attr, name, modelName);
        if(!res) throw 'error analysing attribute: '+name;

        if(res.kind == 'attribute'){
            let formattedAttr = {
                name: name,
                queryParameter: true,
                type: res.type,
                relation:res.relation,
                include: true,
                attribute: attr,
            };
            attributes[name] = formattedAttr;
        }else if(res.kind == 'object'){
            let formattedAssoc = {
                associationName:name,
                referenceName:res.type,
                associationType:res.relation,//one or many
                association:attr,
            };

            new_models = getModelsFromModel({name:res.type, obj:res.value}, formatted_models);
            assosications[name] = formattedAssoc;
        }else{
            throw new Error('unknown kind of attribute')
        }
    }

    let nmodel = {
        name:modelName,
        model:tmodel.model,
        attributes,
        assosications
    };

    let fmodel = formatModel(nmodel);

    formatted_models[fmodel.name] = fmodel;
    return fmodel;
}

const addMutationCreate = module.exports.addMutationCreate = (model) => {

};

const addQueryGetSingle = module.exports.addQueryGetSingle = (model) => {

};

const addQueryGetAll = module.exports.addQueryGetAll = (model) => {

};

const addGetSingle = module.exports.addGetSingle = async (instance, model) => {

    let actualModel = model.model;

    if (!instance.Query[model.queryGetSingleName]) {

        instance.queries += instance.makeRowStr(model.queryGetSingleName, model);

        instance.Query[model.queryGetSingleName] = async (parent, args, {}, info) => {

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