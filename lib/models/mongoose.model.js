const {Model}           = require('./class');
const graphqlFields     = require('graphql-fields');
const MongooseHelper    = require('../helpers/mongoose.helper');

class MongooseModel extends Model {
    async loadGetSingle(instance) {
      if(!this.can('getSingle')) return;

      let actualModel = this.model;

      if (!instance.Query[this.queryGetSingleName]) {
          instance.queries += this.makeRowStr('getSingle');

          instance.Query[this.queryGetSingleName] = async (parent, args, {}, info) => {

              let requested = graphqlFields(info);
              let query = {};
              if(args.where) query = args.where;

              let data;
              try {
                  data = await actualModel.findOne(query);
              }catch(err){
                  return err;
              }

              if(!data) return {};

              return data.toJSON();
          }
      }
    }

    loadGetAll(instance){
      if(!this.can('getAll')) return;

      let actualModel = this.model;

      if (!instance.Query[this.queryGetAllName]) {

        let newStr = this.makeRowStr('getAll');
        if(!newStr) return;

        instance.queries += newStr;

        instance.Query[this.queryGetAllName] = async (parent, args, {}, info) => {

          // let query = Object.assign({}, args);

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
    }

}
module.exports.MongooseModel = MongooseModel;
