const util = require('./util');

const { makeExecutableSchema }                    = require('graphql-tools');
const pluralize                                   = require('pluralize');
const fs                                          = require('fs');
const graphqlFields                               = require('graphql-fields');
const { PubSub, withFilter }          = require('graphql-subscriptions');
const _ = require('lodash');
const SequelizeHelper = require('./sequelizeHelper');
const MongooseHelper = require('./mongooseHelper');

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
      let models = this.mongoose.models;
      for(let key in models){
        let model = models[key];

        let modelName = model.modelName
        if(!modelName) continue;

        let associations = MongooseHelper.loadAssociations(model);
        let attributes   = MongooseHelper.loadAttributes(model);
        let options      = MongooseHelper.loadOptions(model);

        let CapModelName = util.capitalizeFirstLetter(modelName);
        let PluralCapModelName = pluralize.plural(CapModelName);

        this.models[modelName] = {
          type                :'mongoose',
          name                : model.modelName,
          objectKey           : key,

          associations        : associations,
          attributes          : attributes,
          model               : model,
          options             : options,

          schema              : null,
          resolvers           : null,
          queryInputName      : `${CapModelName}WhereInput`,
          querySingleName     : `get${CapModelName}`,
          queryAllName        : `get${PluralCapModelName}`,
        }
      }
    }

    initSequelize(){
        let models = this.sequelize.models;

        for(let key in models){
            let model = models[key];
            let modelName = model.name
            if(!modelName) continue;

            if(this.models[model.name]) throw `duplicate model name: ${model.name}`;

            let associations = SequelizeHelper.loadAssociations(model);
            let attributes   = SequelizeHelper.loadAttributes(model);
            let options      = SequelizeHelper.loadOptions(model);

            let CapModelName = util.capitalizeFirstLetter(modelName);
            let PluralCapModelName = pluralize.plural(CapModelName);

            this.models[modelName] = {
                type                :'sequelize',
                name                : model.name,
                objectKey           : key,
                associations        : associations,
                attributes          : attributes,
                model               : model,
                options             : options,

                schema              : null,
                resolvers           : null,
                queryInputName      : `${CapModelName}WhereInput`,
                querySingleName     : `get${CapModelName}`,
                queryAllName        : `get${PluralCapModelName}`,
            }
        }

        // console.log(this.models);

        // this.models = this.sequelize.models;
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


    loadAssociations(model, ntypes){
        let assocs = model.associations;

        for( let key in assocs){
            let assoc = assocs[key];
            let referenceName = assoc.referenceName;

            let relation = assoc.associationType;

            let w = this.makeRowStr(key, this.models[referenceName], {association: relation, limit:true});

            ntypes += w
        }

        ntypes += `}\n`;

        return ntypes;
    }

    composeTypesAndResolvers(){
        let ntypes = '';
        let inputTypes = '';

        for(let key in this.models){
            if(key==='connection' || key==='Sequelize' || key ==='sequelize' || key == 'undefined') continue;

            let model = this.models[key];
            let schema_name = model.name;

            if(this.capitalize === true) schema_name = util.capitalizeFirstLetter(schema_name);


            ntypes += `type ${schema_name} { \n`;

            inputTypes += `input ${model.queryInputName} { \n`;

            let attrs = model.attributes;

            for(let attr_name in attrs){

                let attr = attrs[attr_name];

                if(attr.include) ntypes += util.createRow(attr_name, attr.type);
                if(attr.queryParameter) inputTypes+= util.createRow(attr_name, attr.type);
            }

            let additional = model.addToGraphQLSchema;

            if(additional){
                let atr_keys = Object.keys(atrs);
                for(let key in additional){
                    if(atr_keys.includes(key)) continue;

                    let atr = additional[key];
                    let g_type = util.getType(atr.type);
                    ntypes += util.createRow(key, g_type);
                }
            }

            inputTypes += `}\n`;

            ntypes = this.loadAssociations(model, ntypes);
        }

        let whole = this.getTypeFromResolver();
        let mutations_and_queries = whole.types;

        this.schema    = `${inputTypes}\n${mutations_and_queries}\n${ntypes}`;
        this.resolvers = whole.resolvers;
    }

    makeRowStr(name, model, options){
        if(!name)  throw new Error('name is required');
        if(!model) throw new Error('model is required');

        let defaults = {
            association: 'one',
            limit:false,
        };
        Object.assign(defaults, options);

        let str = '';
        str += `\t${name} (`;

        let model_name = util.capitalizeFirstLetter(model.name);
        let type_name = (this.capitalize) ? model_name : model.name;


        str += `where: ${model.queryInputName},`;
        if(defaults.limit && defaults.association === 'many'){
            str += `limit: Int, `;
            str += `offset: Int `;
        }

        if(defaults.association === 'many')  type_name = `[${type_name}]`;

        str += `): ${type_name}\n`;

        return str;
    }

    loadCreateMutation(model){
      if(model.type !== 'sequelize') return;

      let actualModel = model.model;
      let model_name = util.capitalizeFirstLetter(model.name);
      let all_query_name = `create${model_name}`;
    }


    loadGetSingle(model){
        switch (model.type) {
          case 'sequelize':
            SequelizeHelper.addGetSingle(this, model);
            break;
          case 'mongoose':
            MongooseHelper.addGetSingle(this, model);
            break;
          default:
            break;
        }
    }

    loadGetterQuery(model){
      switch (model.type) {
        case 'sequelize':
          SequelizeHelper.addGetAll(this, model)
          break;
        case 'mongoose':
          MongooseHelper.addGetAll(this, model)
          break;
        default:
          break;
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
