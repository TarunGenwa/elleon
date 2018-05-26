const _ = require('lodash');
const pluralize                                   = require('pluralize');
const util = require('./util');

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

        getModelsFromModel(tmodel, formatted_models);//formats all the models
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
    let CapModelName        = util.capitalizeFirstLetter(modelName);
    let PluralCapModelName  = pluralize.plural(CapModelName);

    let fmodel = {
        type                :'mongoose',
        name                : modelName,
        objectKey           : modelName,
        model               : tmodel.model,

        associations        : tmodel.assosications,
        attributes          : tmodel.attributes,

        schema              : null,
        resolvers           : null,
        queryInputName      : `${CapModelName}WhereInput`,
        querySingleName     : `get${CapModelName}`,
        queryAllName        : `get${PluralCapModelName}`,

        getSingle           : false,
        getAll              : false
    };

    if(tmodel.model){
        fmodel.getSingle    = true;
        fmodel.getAll       = true;
    }

    return fmodel;
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
// console.log(model.schema.obj);
// console.log(model.schema.obj.first, "test");//attribute by .type or by not .obj
// console.log(model.schema.obj.school, "test");//intrsic object no .type or .obj
// console.log(model.schema.obj.family, 'test');//instrisic array of object no .type or .obj
// console.log(model.schema.obj.info.obj, 'test');//extrisnic object no .type but .obj
// console.log(model.schema.obj.infos[0].obj, 'test');//extrisnic array of object no .type but .obj
// console.log(model.schema.obj.familyIds[0], 'test');//extrisnic array of Numbers know by .type or not .obj