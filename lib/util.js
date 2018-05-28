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
    }else if(check.includes('int') || check.includes('number')){
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

