const _ = require('lodash');
const { PubSub }          = require('graphql-subscriptions');


let pubsubN;
const getPubsub = module.exports.getPubsub = function(options){
    if(options.pubsub){
        return options.pubsub
    }else{
        if(!pubsubN){
            pubsubN = new PubSub();
        }
        return pubsubN;
    }
};

const capitalizeFirstLetter = module.exports.capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

const getType = module.exports.getType = (model_type) =>{
    let check = model_type.toLowerCase();
    if(check.includes('tiny') || check.includes('bool')){
        return 'Boolean';
    }else if(check.includes('int')){
        return 'Int';
    }else if(check.includes('string')){
        return 'String';
    }else if(check.includes('date')){
        return 'String';
    }else if(check.includes('object')){
        return 'String';
    }else{
        return 'String';
    }
};

const createRow = module.exports.createRow = (name, returnValueType, queryParams) => {
    return (queryParams) ?
        `\t${name}${queryParams}: ${returnValueType}\n` : `\t${name}: ${returnValueType}\n`;
};

const createRowN = module.exports.createRowN = (name, returnValueType, queryParams) => {
    return (queryParams) ?
        `\t${name}${queryParams}(limit:Int): ${returnValueType}\n` : `\t${name}(limit:Int): ${returnValueType}\n`;
};

const getIncludes = module.exports.getIncludes = (requested, model, models) => {

    let includes = [];
    for(let i in requested){
        let value = requested[i];

        if(_.isEmpty(value)) continue;

        let assoc = model.associations[i];
        let assoc_model = models[assoc.referenceName];

        let single = {
            model:assoc_model.model,
            as:i,
        };

        let other_include = getIncludes(value, assoc_model, models);
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
