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

            getSingleQuery: false,
            getAllQuery: false,
            createMutation:false,
            updateMutation:false,
            removeMutation:false,

            subscriptions:false,

            sequelize:{
                models:null,
            },
            mongoose:{
                models:null,
            },
            resolver_path: null,
            schema_path: null,
            pubsub: null,
            resolvers: null,
        };
        Object.assign(this, defaults, options);

        this.models = {};
        this.initSequelize();
        this.initMongoose();


        if(_.isEmpty(this.models))        throw 'models are missing';

    }


    initCustomSchemaPath(){
      if(!this.schema_path) return;

      const { fileLoader, mergeTypes } = require('merge-graphql-schemas');

      if(!fs.existsSync(this.schema_path)){
        throw new Error(`Directory: ${this.schema_path} does not exist cannot pull in custom schema`);
      }

      let moreTypes = fileLoader(this.schema_path);

      moreTypes.push(this.schema);
      let merged = mergeTypes(moreTypes);
      this.schema = merged;
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

        if(!fs.existsSync(this.resolver_path)){
          throw new Error(`Directory: ${this.resolver_path} does not exist cannot pull in resolvers`);
        }

        if(this.resolver_path){
          fs.readdirSync(this.resolver_path)
            .filter(file => {
              return (file.indexOf('.') !== 0) && (file.slice(-3) === '.js');
            }).forEach(file => {
            let resolver = require(this.resolver_path+'/'+file);

            resolver.models = this.models;

            for (let res in resolver){
              let val = resolver[res];
              let knownTypes = ['Mutation', 'Query', 'Subscription'];

              if(typeof val.type === 'undefined') continue;//because models are being added they do not have a type
              if(!knownTypes.includes(val.type)) throw new Error(`Type: "${val.type}" not known, type must be either Query or Mutation`);

              this[val.type][res] = val.resolver;

              let schemaTypeObjectName = val.type.toLowerCase();
              schemaTypeObjectName = (val.type === 'Query') ? schemaTypeObjectName = schemaTypeObjectName.slice(0, -1)+'ies': schemaTypeObjectName += 's';

              let returnType = this.getReturnTypeFromValue(val.returnType);

              let resolverArgs = '';
              if(val.arguments){
                  resolverArgs = val.arguments;
              }
              this[schemaTypeObjectName] += `\t${res}${resolverArgs}: ${returnType}\n`;
            }

          });
        }
    };

    getReturnTypeFromValue(value){
        let returnType;
        if(_.isString(value)){
            returnType = value;
        }else if(_.isArray(value)){
            let inside = value[0];
            let insideString;
            if(_.isString(inside)){
                insideString = inside;
            }
            returnType = `[${insideString}]`;
        }else if(_.isFunction(value)){
            let inside = value();
            let insideString;
            if(_.isString(inside)){
                insideString = inside;
            }else if(_.isArray(inside)){
                insideString = `[${inside[0]}]`;
            }
            returnType =  insideString;
        }

        return returnType;
    }

    getDefaultTypes(){
      let UpdateResponseType =
`type UpdateResponse {
  success: Boolean
  message: String
}\n`;

      let DeleteResponseType =
`type DeleteResponse {
  success: Boolean
  message: String
}`;

      return  UpdateResponseType+DeleteResponseType
    }
    composeTypesAndResolvers(){
        let ntypes = '';
        let inputTypes = '';

        let defaults = this.getDefaultTypes();

        for(let key in this.models){
            if(key==='connection' || key==='Sequelize' || key ==='sequelize' || key == 'undefined') continue;
            let model = this.models[key];

            let {schemaType, inputType} = model.getAttributeStr(this.models);

            ntypes += schemaType;
            inputTypes += inputType;
        }

        let whole = this.getTypeFromResolver();
        let mutations_and_queries = whole.types;

        this.schema    = `${defaults}\n${inputTypes}\n${mutations_and_queries}\n${ntypes}`;
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

            if (this.getSingleQuery)    model.loadGetSingle(this);
            if (this.getAllQuery)       model.loadGetAll(this);
            if (this.createMutation)    model.loadCreate(this);
            if (this.updateMutation)    model.loadUpdate(this);
            if (this.deleteMutation)    model.loadDelete(this);


            // if (this.subscriptions) {
            //     this.addSubscriptions(model);
            // }
        }

        return this.finalizeSchema();
    };

    getTypeDefsAndResolvers(){
        this.initResolvers();
        this.composeTypesAndResolvers();

        this.initCustomSchemaPath();

        if(this.logging){
            console.log(this.schema, this.resolvers);
        }
        return {
            typeDefs:this.schema,
            resolvers:this.resolvers,
        }
    }

    makeExecuteableSchema(){
        this.initResolvers();
        this.composeTypesAndResolvers();

        this.initCustomSchemaPath();

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

