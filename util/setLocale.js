var models = require('../models')
const Sequelize = require('sequelize')
const Op = Sequelize.Op

module.exports = async (ctx) => {
  const user = await models.User.findOne({
    where: {
      tId: {
        [Op.eq]: ctx.from.id
      }
    }
  })
  if (user) {
    ctx.i18n.locale(user.locale)
  }
}
