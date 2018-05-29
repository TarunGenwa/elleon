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
        // console.log('test');
    }

}
module.exports.MongooseModel = MongooseModel;