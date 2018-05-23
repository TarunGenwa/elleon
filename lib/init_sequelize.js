let util = require('./util');

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