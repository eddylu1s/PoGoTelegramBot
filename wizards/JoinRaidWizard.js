// ===================
// join raid wizard
// ===================
const WizardScene = require('telegraf/scenes/wizard')
const moment = require('moment-timezone')
const {Markup} = require('telegraf')
var models = require('../models')
const Sequelize = require('sequelize')
const Op = Sequelize.Op
const listRaids = require('../util/listRaids')

moment.tz.setDefault('Europe/Amsterdam')

function JoinRaidWizard (bot) {
  return new WizardScene('join-raid-wizard',
    async (ctx) => {
      ctx.session.joinedraid = null
      // ToDo: check for endtime
      let raids = await models.Raid.findAll({
        include: [models.Gym, models.Raiduser],
        where: {
          endtime: {
            [Op.gt]: moment().unix()
          }
        }
      })
      if (raids.length === 0) {
        return ctx.answerCbQuery(null, undefined, true)
          .then(() => ctx.replyWithMarkdown('Sorry, er is nu geen raid te doen… 😉\n\n*Je kunt nu weer terug naar de groep gaan. Wil je nog een actie uitvoeren? Klik dan hier op */start'))
          .then(() => ctx.deleteMessage(ctx.update.callback_query.message.message_id))
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
        gymname: '…toch niet meedoen',
        raidid: 0
      })
      ctx.session.raidbtns.push('…toch niet meedoen')
      // save all candidates to session…
      ctx.session.raidcandidates = candidates
      return ctx.answerCbQuery(null, undefined, true)
        .then(() => ctx.replyWithMarkdown('Kies een raid…', Markup.keyboard(ctx.session.raidbtns).oneTime().resize().extra()))
        .then(() => ctx.wizard.next())
    },

    async (ctx) => {
      // retrieve selected candidate  from session…

      let ind = ctx.session.raidbtns.indexOf(ctx.update.message.text)
      if (ind === -1) {
        return ctx.replyWithMarkdown('Raid niet gevonden!\n*Je kunt nu weer terug naar de groep gaan. Wil je nog een actie uitvoeren? Klik dan hier op */start', Markup.removeKeyboard().extra())
      }
      let selectedraid = ctx.session.raidcandidates[ind]
      if (selectedraid.raidid === 0) {
        return ctx.replyWithMarkdown('Jammer! \n\n*Je kunt nu weer terug naar de groep gaan. Wil je nog een actie uitvoeren? Klik dan hier op */start', Markup.removeKeyboard().extra())
          .then(() => {
            ctx.session.raidcandidates = null
            return ctx.scene.leave()
          })
      }
      // save selected index to session
      ctx.session.joinedraid = parseInt(ind)
      ctx.session.accountbtns = [['1'], ['2', '3', '4', '5']]
      return ctx.replyWithMarkdown(`Met hoeveel accounts/mensen kom je naar *${selectedraid.gymname}*?`, Markup.keyboard(ctx.session.accountbtns).extra())
        .then(() => ctx.wizard.next())
    },
    async (ctx) => {
      const accounts = parseInt(ctx.update.message.text)
      const joinedraid = ctx.session.raidcandidates[ctx.session.joinedraid]

      const user = ctx.from
      // Check already registered? If so; update else store new
      let raiduser = await models.Raiduser.find({
        where: {
          [Op.and]: [{uid: user.id}, {raidId: joinedraid.raidid}]
        }
      })
      if (raiduser) {
        // update
        try {
          await models.Raiduser.update(
            { accounts: accounts },
            { where: { [Op.and]: [{uid: user.id}, {raidId: joinedraid.raidid}] } }
          )
        } catch (error) {
          return ctx.replyWithMarkdown('Hier ging iets niet goed tijdens het updaten… \n*Misschien opnieuw proberen?*', Markup.removeKeyboard().extra())
            .then(() => ctx.scene.leave())
        }
      } else {
        // new raid user
        let raiduser = models.Raiduser.build({
          raidId: joinedraid.raidid,
          username: user.first_name,
          uid: user.id,
          accounts: accounts
        })
        try {
          await raiduser.save()
        } catch (error) {
          console.log('Woops… registering raiduser failed', error)
          return ctx.replyWithMarkdown(`Hier ging iets *niet* goed tijdens het bewaren…\nMisschien kun je het nog eens proberen met /start. Of ga terug naar de groep.`, Markup.removeKeyboard())
            .then(() => ctx.scene.leave())
        }
      }
      let out = await listRaids(`[${user.first_name}](tg://user?id=${user.id}) toegevoegd aan raid bij ${joinedraid.gymname}\n\n`)
      if (out === null) {
        return ctx.replyWithMarkdown(`Mmmm, vreemd. Sorry, geen raid te vinden.\n*Je kunt nu weer terug naar de groep gaan. Wil je nog een actie uitvoeren? Klik dan hier op */start`, Markup.removeKeyboard())
          .then(() => ctx.scene.leave())
      }
      return ctx.replyWithMarkdown(`Je bent aangemeld voor ${joinedraid.gymname} om ${joinedraid.startsat} 👍\n\n*Je kunt nu weer terug naar de groep gaan. Wil je nog een actie uitvoeren? Klik dan hier op */start`, Markup.removeKeyboard().extra())
        .then(async () => {
          bot.telegram.sendMessage(process.env.GROUP_ID, out, {parse_mode: 'Markdown', disable_web_page_preview: true})
        })
        .then(() => ctx.scene.leave())
    }
  )
}
module.exports = JoinRaidWizard
