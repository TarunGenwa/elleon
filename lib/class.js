const util = require('./util');

const { makeExecutableSchema }                    = require('graphql-tools');
const pluralize                                   = require('pluralize');
const fs                                          = require('fs');
const graphqlFields                               = require('graphql-fields');
const { PubSub, withFilter }          = require('graphql-subscriptions');
const _ = require('lodash');

class GraphApi {
    constructor(options){
        let defaults = {
            logging: false,
            capitalize: true,
            getters: true,
            subscriptions:false,

            models: null,
            resolver_path: null,
            pubsub: null,

            schema: null,
            resolvers: null,
        };
        Object.assign(defaults, options);
        Object.assign(this, defaults);

        if(!this.models)        throw 'models are missing';
        if(!this.resolver_path) throw 'resolver path missing';

    }

    createSubscription(model, subname, hookname){
        let model_name = util.capitalizeFirstLetter(model.name);
        let type_name = (this.capitalize) ? model_name : model.name;
        let subscriptionName = `${subname}${model_name}`;
        let event_name = `${model_name}${subname}`;

        let pubsub = util.getPubsub(this);
        if('afterBulkUpdate'){
            model.hook(hookname, (options) => {
                let data = {[subscriptionName]:{id:1, name:'Apple'}};//todo needs to be changed
            console.log(data);
            pubsub.publish(event_name, data);
        });
        }else{
            model.hook(hookname, (instance, options) => {
                let data = {[subscriptionName]:instance.toJSON()};
            console.log(data);
            pubsub.publish(event_name, data);
        });
        }


        if(hookname == 'afterSave' || hookname == 'afterUpdate'){
            this.subscriptions += util.createRow(subscriptionName, type_name, '(id: Int)');

            this.Subscription[subscriptionName] = {
                subscribe: withFilter(
                    () => pubsub.asyncIterator(event_name),
            (payload, args) => {
                if(_.isEmpty(args)) return true;
                return payload[subscriptionName].id === args.id
            }

        )
        };
        }else{
            this.subscriptions += util.createRow(subscriptionName, type_name);
            this.Subscription[subscriptionName] = {
                subscribe: () => pubsub.asyncIterator(event_name)
        };
        }
    };

    addSubscriptions(model){
        this.createSubscription(model,     'onSave', 'afterSave');
        this.createSubscription(model,     'onCreate', 'afterCreate');
        this.createSubscription(model,     'onUpdate', 'afterUpdate');
        this.createSubscription(model,     'onBulkUpdate', 'afterBulkUpdate');
        this.createSubscription(model,     'onBulkCreate', 'afterBulkCreate');
    };

    initResolvers(){
        this.mutations       = `type Mutation {\n`;
        this.queries         = `type Query {\n`;
        this.subscriptions   = `type Subscription {\n`;

        this.Query       = {};
        this.Mutation    = {};
        this.Subscription= {};

        fs.readdirSync(this.resolver_path)
            .filter(file => {
            return (file.indexOf('.') !== 0) && (file.slice(-3) === '.js');
    }).forEach(file => {
            let resolver = require(this.resolver_path+'/'+file);
        for (let res in resolver){
            let val = resolver[res];

            if(val.type === 'Mutation'){
                this.mutations += `\t${res}${val.schema}\n`;
                this.Mutation[res] = val.resolver;
            }else if(val.type === 'Query'){
                this.queries += `\t${res} ${val.schema}\n`;
                this.Query[res] = val.resolver;
            }else if(val.type === 'Subscription'){
                this.subscriptions += `\t${res} ${val.schema}\n`;
                this.Subscription[res] = val.resolver;
            }else{
                throw new Error(`Type: "${val.type}" not known, type must be either Query or Mutation`)
            }
        }

    });

    };


    loadAssociations(model, ntypes){
        let assocs = model.associations;

        for( let key in assocs){
            let assoc_name;
            let association_type;

            let we = util.getAssociationTypeFromNickname(key, model);

            assoc_name       = we.name;
            association_type = we.type;


            if(this.capitalize===true) assoc_name = util.capitalizeFirstLetter(assoc_name);

            let relation = 'one';
            if(association_type.includes('Many')) relation = 'many';


            let assoc_info = util.getAssociationTypeFromNickname(key, model);

            let w = this.makeRowStr(key, this.models[assoc_info.name], {association: relation, limit:true});

            ntypes += w
        }

        ntypes += `}\n`;

        return ntypes;
    }

    composeTypesAndResolvers(){
        let ntypes = '';

        for(let key in this.models){
            if(key==='connection' || key==='Sequelize' || key ==='sequelize' || key == 'undefined') continue;

            let model = this.models[key];
            let schema_name = model.name;

            if(this.capitalize === true){
                schema_name = util.capitalizeFirstLetter(schema_name);
            }

            if(model.GraphQL === false) continue;
            ntypes += `type ${schema_name} { \n`;
            let atrs = model.attributes;

            let remove = model.removeFromGraphQLSchema;
            if(!remove) remove = [];

            for(let atr_name in atrs){

                if(remove.includes(atr_name)) continue;
                let atr = atrs[atr_name];

                if(atr.graphql !== false){
                    let g_type = util.getType(atr.type.toString());
                    ntypes += util.createRow(atr_name, g_type)

                }

            }

            let additional = model.addToGraphQLSchema;

            if(additional){
                let atr_keys = Object.keys(atrs);
                for(let key in additional){
                    if(atr_keys.includes(key)) continue;

                    let atr = additional[key];
                    let g_type = getType(atr.type);
                    ntypes += util.createRow(key, g_type);
                }
            }

            ntypes = this.loadAssociations(model, ntypes);
        }

        let whole = this.getTypeFromResolver();
        let mutations_and_queries = whole.types;

        this.schema    = `${mutations_and_queries}\n${ntypes}`;
        this.resolvers = whole.resolvers;
    }

    makeRowStr(name, model, options){
        let defaults = {
            association: 'one',
            limit:false,
        };
        Object.assign(defaults, options);

        let str = '';
        str += `\t${name} (`;

        let atrs = model.attributes;
        for (let i in atrs) {
            let atr = atrs[i];
            let g_type = util.getType(atr.type.toString());

            str += `${i}: ${g_type}, `;
        }

        let model_name = util.capitalizeFirstLetter(model.name);
        let type_name = (this.capitalize) ? model_name : model.name;

        if(defaults.association === 'many')  {
            type_name = `[${type_name}]`;
        }

        if(defaults.limit && defaults.association === 'many'){
            str += `limit: Int, `;
            str += `offset: Int `;
        }

        str += `): ${type_name}\n`;

        return str;
    }

    loadGetSingle(model){
        let model_name = util.capitalizeFirstLetter(model.name);
        let query_name = `get${model_name}`;

        if (!this.Query[query_name]) {

            this.queries += this.makeRowStr(query_name, model);

            this.Query[query_name] = async (parent, args, {models}, info) => {

                let requested = graphqlFields(info);

                let includes = util.getIncludes(requested, model, models);

                let data;
                try {
                    data = await model.findOne({where: args, include: includes});
                } catch (err) {
                    console.log('err', err);
                    return false
                }

                if (this.logging && data) console.log(data.toJSON());

                return util.getResolverValues(requested, data);
            }
        }

    }

    loadGetterQuery(model){
        let model_name = util.capitalizeFirstLetter(model.name);

        let p_model_name = pluralize.plural(model_name);
        let all_query_name = `get${p_model_name}`;

        if (!this.Query[all_query_name]) {

            this.queries += this.makeRowStr(all_query_name, model, {association: 'many', limit:true});


            this.Query[all_query_name] = async (parent, args, {models}, info) => {

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

                let includes = util.getIncludes(requested, model, models);

                model_params.where   = query;
                model_params.include = includes;

                let data;

                try {
                    data = await model.findAll(model_params);
                } catch (err) {
                    return false
                }

                if (this.logging) console.log(data);

                return util.getResolverValues(requested, data);
            }

        }
    }

    finalizeSchema(){
        this.mutations       += '}';
        this.queries         += '}';
        this.subscriptions   += '}';

        let types;
        let resolvers = {};

        types = `schema {`;
        if(!_.isEmpty(this.Query))             types += `\n\tquery: Query`;
        if(!_.isEmpty(this.Mutation))          types += `\n\tmutation: Mutation`;
        if(!_.isEmpty(this.Subscription))      types += `\n\tsubscription: Subscription`;
        types += `\n}\n`;

        if(!_.isEmpty(this.Query)){
            types += `${this.queries}\n`;
            resolvers.Query = this.Query;
        }
        if(!_.isEmpty(this.Mutation)){
            types += `${this.mutations}\n`;
            resolvers.Mutation = this.Mutation;
        }
        if(!_.isEmpty(this.Subscription)){
            types += `${this.subscriptions}\n`;
            resolvers.Subscription = this.Subscription;
        }

        return {types, resolvers};
    }

    getTypeFromResolver() {
        for(let key in this.models) {

            if (key === 'connection' || key === 'Sequelize' || key === 'sequelize' || key == 'undefined') continue;
            let model = this.models[key];

            if (this.getters === true) {
                this.loadGetSingle(model);
                this.loadGetterQuery(model);
            }

            if (this.subscriptions) {
                this.addSubscriptions(model);
            }
        }

        return this.finalizeSchema();
    };

    makeExecuteableSchema(){
        this.initResolvers();
        this.composeTypesAndResolvers();

        if(this.logging){
            console.log(this.schema, this.resolvers);
        }
        return makeExecutableSchema({
            typeDefs:this.schema,
            resolvers:this.resolvers,
        });
    }

}
module.exports = GraphApi;
