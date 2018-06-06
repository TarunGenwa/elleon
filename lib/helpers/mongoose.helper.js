const _ = require('lodash');
const pluralize                                   = require('pluralize');
const util = require('../util');

const {MongooseModel} = require('../models/mongoose.model');
const {Attribute} = require('../attributes/class');

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
        attributes          : tmodel.attributes,
    };

    if(!tmodel.model){
        fmodel.queryGetSingle    = false;
        fmodel.queryGetAll       = false;
        fmodel.mutationCreate       = false;
        fmodel.mutationUpdate       = false;
        fmodel.mutationDelete       = false;
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

    let new_models = {};
    let modelName = tmodel.name;
    let attrs = tmodel.obj;

    let attributes = {};

    for (let name in attrs){
        let attr = attrs[name];
        let res = analyseAttr(attr, name, modelName);
        if(!res) throw 'error analysing attribute: '+name;

        if(res.kind == 'attribute'){
            let formattedAttr = {
                name: name,
                schemaType: res.type,
                relation:res.relation,
                actual: attr,
                type:'property',
                parentType:'mongoose',
                paramOptions:{//todo revisit
                    getSingle:true
                }
            };

            attributes[name] =  new Attribute(formattedAttr);
        }else if(res.kind == 'object'){

            let formattedAssoc = {
                name:name,
                schemaType:util.capitalizeFirstLetter(res.type),
                relation:res.relation,//one or many
                actual:attr,
                type:'association',
                parentType: 'mongoose',
                paramOptions:{//todo revisit
                    getSingle:true,
                }
            };

            new_models = getModelsFromModel({name:res.type, obj:res.value}, formatted_models);
            attributes[name] = new Attribute(formattedAssoc);
        }else{
            throw new Error('unknown kind of attribute')
        }
    }

    let nmodel = {
        name:modelName,
        model:tmodel.model,
        attributes,
    };

    let fmodel = formatModel(nmodel);

    formatted_models[fmodel.capName] = fmodel;
    return fmodel;
};

const getSelectStrFromRequested = module.exports.getSelectStrFromRequested = (requested, selectKey) => {
  let str = '';

  for(let key in requested){
    let value = requested[key];
    if(!_.isEmpty(value)){
      let newSelectKey
      if(selectKey){
        newSelectKey = `${selectKey}.${key}`;
      }else{
        newSelectKey = `${key}`;
      }

      let add = getSelectStrFromRequested(value, newSelectKey);
      str += ` ${add}`
    }else{
      if(!selectKey){
        str += ` ${key}`
      }else{
        str += ` ${selectKey}.${key}`
      }
    }
  }

  return str;
};
