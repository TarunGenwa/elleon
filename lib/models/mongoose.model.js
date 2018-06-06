const {Model}           = require('./class');
const graphqlFields     = require('graphql-fields');
const MongooseHelper    = require('../helpers/mongoose.helper');
const util = require('../util');

class MongooseModel extends Model {
    async loadGetSingle(instance) {
      if(!this.can('getSingle')) return;
      if (instance.Query[this.queryGetSingleName]) return;

      let actualModel = this.model;
      instance.queries += this.makeRowStr('getSingle');

      instance.Query[this.queryGetSingleName] = async (parent, args, {}, info) => {

          let requested = graphqlFields(info);
          let selectStr = MongooseHelper.getSelectStrFromRequested(requested);

          let query = util.flatten(args.where);

          console.log('q', query);
          let data;
          try {
              data = await actualModel.findOne(query, selectStr);
          }catch(err){
              return err;
          }

          if(!data) return {};

          return data.toJSON();
      }
    }

    loadGetAll(instance){
      if(!this.can('getAll')) return;
      if (instance.Query[this.queryGetAllName]) return;

      let actualModel = this.model;
      let newStr = this.makeRowStr('getAll');
      if(!newStr) return;

      instance.queries += newStr;

      instance.Query[this.queryGetAllName] = async (parent, args, {}, info) => {

        let where = args.where;
        let limit = (args.limit) ?  args.limit : 0;
        let offset = (args.offset) ? args.offset : 0;


        let requested = graphqlFields(info);
        let selectStr = MongooseHelper.getSelectStrFromRequested(requested);

        let data;

        try {
          data = await actualModel.find(where, selectStr).skip(offset).limit(limit);
        } catch (err) {
          return false
        }

        return data
      }


    }

    async loadCreate(instance){
      if(!this.can('create')) return;
      if (instance.Mutation[this.mutationCreateName]) return;

      instance.mutations += this.makeRowStr('create');

      let actualModel = this.model;

      instance.Mutation[this.mutationCreateName] = async (parent, args, {}, info) => {
        let createData = args.data;
        let being;
        try{
          being = await actualModel.create(createData)
        }catch(err){

        }

        if(!being) return false;

        return being.toJSON();
      };
    }

  async loadUpdate(instance){
    if(!this.can('update')) return;
    if (instance.Mutation[this.mutationUpdateName]) return;

    instance.mutations += this.makeRowStr('update');

    let actualModel = this.model;

    instance.Mutation[this.mutationUpdateName] = async (parent, args, {}, info) => {
      let updateData = args.data;
      let queryData = args.where;

      let stats;

      try {
        stats = await actualModel.update(queryData, updateData)
      } catch (err) {
        return {
          success:false,
          message: err.toString(),
        }
      }

      return {
        success: true,
        message: `Successfully updated data with model ${this.capName}`,
      };
    }
  }

  loadDelete(instance){
    if(!this.can('delete')) return;
    if (instance.Mutation[this.mutationDeleteName]) return;

    instance.mutations += this.makeRowStr('delete');

    let actualModel = this.model;

    instance.Mutation[this.mutationDeleteName] = async (parent, args, {}, info) => {
      let queryData = args.where;

      let stats;

      try {
        stats = await actualModel.remove(queryData)
      } catch (err) {
        return {
          success:false,
          message: err.toString(),
        }
      }

      return {
        success: true,
        message: `Successfully deleted data with model ${this.capName}`,
      };
    }
  }
}
module.exports.MongooseModel = MongooseModel;
