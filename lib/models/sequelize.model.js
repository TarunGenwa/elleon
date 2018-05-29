const {Model} = require('./class');
const Helper = require('../helpers/sequelize.helper');
const graphqlFields                               = require('graphql-fields');

class SequelizeModel extends Model {
    async loadGetSingle(instance) {
        let actualModel = this.model;

        if (!instance.Query[this.queryGetSingleName]) {

            instance.queries += this.makeRowStr('getSingle');

            instance.Query[this.queryGetSingleName] = async (parent, args, {}, info) => {

                let requested = graphqlFields(info);

                let includes = Helper.getIncludes(requested, this, instance.models);

                let data;
                try {
                    data = await actualModel.findOne({where: args.where, include: includes});
                } catch (err) {
                    console.log('err', err);
                    return false
                }

                return getResolverValues(requested, data);
            }
        }
    }

    async loadGetAll(instance){
        let actualModel = this.model;

        if (!instance.Query[this.queryGetAllName]) {

            instance.queries += this.makeRowStr('getAll');

            instance.Query[this.queryGetAllName] = async (parent, args, {}, info) => {

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

                let includes = Helper.getIncludes(requested, this, instance.models);

                model_params.where   = args.where;
                model_params.include = includes;

                let data;

                try {
                    data = await actualModel.findAll(model_params);
                } catch (err) {
                    return false
                }

                return getResolverValues(requested, data);
            }

        }
    }

}
module.exports.SequelizeModel = SequelizeModel;