// ===================
// add gym wizard
// ===================
const WizardScene = require('telegraf/scenes/wizard')
const moment = require('moment-timezone')
const {Markup} = require('telegraf')
var models = require('../models')
const Sequelize = require('sequelize')
const Op = Sequelize.Op
const listRaids = require('../util/listRaids')

moment.tz.setDefault('Europe/Amsterdam')

var UserDelayedGymWizard = function (bot) {
  return new WizardScene('user-delayed-wizard',
    async (ctx) => {
      ctx.session.delayedraid = null
      const user = ctx.from
      let raids = await models.Raid.findAll({
        where: {
          endtime: {
            [Op.gt]: moment().unix()
          }
        },
        include: [
          models.Gym,
          {
            model: models.Raiduser,
            where: {
              'uid': user.id
            }
          }
        ]
      })
      if (raids.length === 0) {
        return ctx.replyWithMarkdown('Sorry, er is nu geen raid te doen… 😉\n\n*Je kunt nu weer terug naar de groep gaan. Wil je nog een actie uitvoeren? Klik dan hier op */start', Markup.removeKeyboard())
          .then(() => ctx.scene.leave())
      }
      // buttons to show, with index from candidates as data (since maxlength of button data is 64 bytes…)
      ctx.session.raidbtns = []
      let candidates = []
      for (var a = 0; a < raids.length; a++) {
        let strttm = moment.unix(raids[a].start1).format('H:mm')
        candidates[a] = {
          gymname: raids[a].Gym.gymname,
          raidid: raids[a].id,
          startsat: strttm
        }
        ctx.session.raidbtns.push(`${raids[a].Gym.gymname} ${strttm}; ${raids[a].target}`)
      }
      candidates.push({
        gymname: ctx.i18.t('user_delayed_dont_change_status'),
        raidid: 0
      })
      ctx.session.raidbtns.push(ctx.i18.t('user_delayed_dont_change_status'))
      // save all candidates to session…
      ctx.session.raidcandidates = candidates
      return ctx.replyWithMarkdown(ctx.i18n.t('user_delayed_select_raid'), Markup.keyboard(ctx.session.raidbtns).oneTime().resize().extra())
        .then(() => ctx.wizard.next())
    },

    async (ctx) => {
      // retrieve selected candidate  from session…
      let ind = ctx.session.raidbtns.indexOf(ctx.update.message.text)
      if (ind === -1) {
        return ctx.replyWithMarkdown(ctx.i18n.t('join_raid_not_found'), Markup.removeKeyboard().extra())
      }
      let selectedraid = ctx.session.raidcandidates[ind]
      if (selectedraid.raidid === 0) {
        return ctx.replyWithMarkdown(ctx.i18n.t('join_raid_cancel'), Markup.removeKeyboard().extra())
          .then(() => {
            ctx.session.raidcandidates = null
            return ctx.scene.leave()
          })
      }
      // save selected index to session
      ctx.session.delayedraid = parseInt(ind)
      ctx.session.accountbtns = [['2','5'], [ctx.i18n.t('user_delayed_is_on_time')]]
      return ctx.replyWithMarkdown(`${ctx.i18n.t('user_delayed_how_much_later', {gymname: selectedraid.gymname})}`, Markup.keyboard(ctx.session.accountbtns).extra())
        .then(() => ctx.wizard.next())
    },
    async (ctx) => {
      const delay = ctx.update.message.text
      const delayedraid = ctx.session.raidcandidates[ctx.session.delayedraid]
      const user = ctx.from
      // Check already registered? If so; update
      let raiduser = await models.Raiduser.find({
        where: {
          [Op.and]: [{uid: user.id}, {raidId: delayedraid.raidid}]
        }
      })
      if (raiduser) {
        let reason = ''
        let val = null
        switch(delay){
          case '2':
            reason = `[${user.first_name}](tg://user?id=${user.id}) komt 2 minuten later bij ${delayedraid.gymname}`
            val = '2 min.'
            break
          case '5':
            reason = `[${user.first_name}](tg://user?id=${user.id}) komt 5 minuten later bij ${delayedraid.gymname}`
            val = '5 min.'
            break
          case '…ik kom toch op tijd!':
            reason = `[${user.first_name}](tg://user?id=${user.id}) komt toch op tijd bij ${delayedraid.gymname}`
            val = null
            break
        }
        try {
          await models.Raiduser.update(
            { delayed: val },
            { where: { [Op.and]: [{uid: user.id}, {raidId: delayedraid.raidid}] } }
          )

        } catch (error) {
          return ctx.replyWithMarkdown('Hier ging iets niet goed tijdens het updaten… \n*Misschien opnieuw proberen?*', Markup.removeKeyboard().extra())
            .then(() => ctx.scene.leave())
        }
        let out = await listRaids(`${reason}\n\n`)
        return ctx.replyWithMarkdown(`Je status voor ${delayedraid.gymname} is gewijzigd 👍\n\n*Je kunt nu weer terug naar de groep gaan. Wil je nog een actie uitvoeren? Klik dan hier op */start`, Markup.removeKeyboard().extra())
        .then(async () => {
          bot.telegram.sendMessage(process.env.GROUP_ID, out, {parse_mode: 'Markdown', disable_web_page_preview: true})
        })
        .then(() => ctx.scene.leave())
      }
    }
  )
}
module.exports = UserDelayedGymWizard