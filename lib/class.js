const util = require('./util');

const { makeExecutableSchema }                    = require('graphql-tools');
const pluralize                                   = require('pluralize');
const fs                                          = require('fs');
const graphqlFields                               = require('graphql-fields');
const { PubSub, withFilter }          = require('graphql-subscriptions');
const _ = require('lodash');
const SequelizeHelper = require('./helpers/sequelize.helper');
const MongooseHelper = require('./helpers/mongoose.helper');

class GraphApi {
    constructor(options){
        let defaults = {
            logging: false,
            capitalize: true,
            getters: true,
            subscriptions:false,

            sequelize:{
                models:null,
            },
            mongoose:{
                models:null,
            },
            resolver_path: null,
            pubsub: null,

            schema: null,
            resolvers: null,
        };
        Object.assign(defaults, options);
        Object.assign(this, defaults);

        this.models = {};
        this.initSequelize();
        this.initMongoose();

        if(_.isEmpty(this.models))        throw 'models are missing';

    }


    initMongoose(){
        let someModels = this.mongoose.models;
        let allModels = MongooseHelper.AbstractAllModels(someModels);

        _.merge(this.models, allModels);
    }
    initSequelize(){
        let models = this.sequelize.models;

        let formatted_models = SequelizeHelper.AbstractAllModels(models, this);

        _.merge(this.models, formatted_models);
    }


    createSubscription(model, subname, hookname){//check if this works
        if(model.type !== 'sequelize'){
          return SequelizeHelper.createSubscriptions(this, model, subname, hookname);
        }

    };

    addSubscriptions(model){
        if(model.type !== 'sequelize') return;
        this.createSubscription(model,     'onSave', 'afterSave');
        this.createSubscription(model,     'onCreate', 'afterCreate');
        this.createSubscription(model,     'onUpdate', 'afterUpdate');
        this.createSubscription(model,     'onBulkUpdate', 'afterBulkUpdate');
        this.createSubscription(model,     'onBulkCreate', 'afterBulkCreate');
    };

    initResolvers(){
        this.input           = ``;
        this.mutations       = `type Mutation {\n`;
        this.queries         = `type Query {\n`;
        this.subscriptions   = `type Subscription {\n`;

        this.Query       = {};
        this.Mutation    = {};
        this.Subscription= {};

        if(this.resolver_path){
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
        }
    };

    composeTypesAndResolvers(){
        let ntypes = '';
        let inputTypes = '';

        for(let key in this.models){
            if(key==='connection' || key==='Sequelize' || key ==='sequelize' || key == 'undefined') continue;
            let model = this.models[key];

            let {schemaType, inputType} = model.getAttributeStr(this.models);

            ntypes += schemaType;
            inputTypes += inputType;
        }

        let whole = this.getTypeFromResolver();
        let mutations_and_queries = whole.types;

        this.schema    = `${inputTypes}\n${mutations_and_queries}\n${ntypes}`;
        this.resolvers = whole.resolvers;
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
                model.loadGetSingle(this);
                model.loadGetAll(this);
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
