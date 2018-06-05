const {Model} = require('./class');
const graphqlFields                               = require('graphql-fields');
class MongooseModel extends Model {
    async loadGetSingle(instance) {
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
                    console.log('test', data)
                }catch(err){
                    return err;
                }

                if(!data) return {};

                return data.toJSON();
            }
        }
    }

    loadGetAll(instance){
      let actualModel = this.model;

      if (!instance.Query[this.queryGetAllName]) {

        let newStr = this.makeRowStr('getAll');
        if(!newStr) return;

        instance.queries += newStr;

        instance.Query[this.queryGetAllName] = async (parent, args, {}, info) => {

          let query = Object.assign({}, args);

          let where = args.where;
          let limit = (args.limit) ?  args.limit : 0;
          let offset = (args.offset) ? args.offset : 0;

          console.log('test', limit);

          let requested = graphqlFields(info);

          let data;

          try {
            data = await actualModel.find(where).skip(offset).limit(limit);
          } catch (err) {
            return false
          }

          return data
        }

      }
    }

}
module.exports.MongooseModel = MongooseModel;
