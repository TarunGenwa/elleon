const {Model} = require('./class');
const SequelizeHelper = require('../helpers/sequelize.helper');
const graphqlFields                               = require('graphql-fields');
const _ = require('lodash');

class SequelizeModel extends Model {

    async loadGetSingle(instance) {
        let actualModel = this.model;

        if (!instance.Query[this.queryGetSingleName]) {

            instance.queries += this.makeRowStr('getSingle');

            instance.Query[this.queryGetSingleName] = async (parent, args, {}, info) => {

                let requested = graphqlFields(info);

                let includes = SequelizeHelper.getIncludes(requested, this, instance.models);

                let data;
                try {
                    data = await actualModel.findOne({where: args.where, include: includes});
                } catch (err) {
                    console.log('err', err);
                    return false
                }

                return SequelizeHelper.getResolverValues(requested, data);
            }
        }
    }

    async loadGetAll(instance){
        let actualModel = this.model;

        if (!instance.Query[this.queryGetAllName]) {

            let newStr = this.makeRowStr('getAll');
            if(!newStr) return;

            instance.queries += newStr;

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

                let includes = SequelizeHelper.getIncludes(requested, this, instance.models);

                model_params.where   = args.where;
                model_params.include = includes;

                let data;

                try {
                    data = await actualModel.findAll(model_params);
                } catch (err) {
                    return false
                }

                return SequelizeHelper.getResolverValues(requested, data);
            }

        }
    }

}
module.exports.SequelizeModel = SequelizeModel;
