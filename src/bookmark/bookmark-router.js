const express = require('express')
const uuid = require('uuid/v4')
const { isWebUri } = require('valid-url')
const logger = require('../logger')
const xss = require('xss')
const store = require('../store')
const BookmarksService = require('./bookmarks-service')
const {getBookmarkValidationError} = require('./bookmark-validator')

const bookmarksRouter = express.Router()
const bodyParser = express.json()


const serializeBookmark = bookmark => ({
  id: bookmark.id,
  title: xss(bookmark.title),
  url: bookmark.url,
  description: xss(bookmark.description),
  rating: Number(bookmark.rating),
})



bookmarksRouter
  .route('/bookmarks')
  .get((req, res, next) => {
    BookmarksService.getAllBookmarks(req.app.get('db'))
      .then(bookmarks => {
        res.json(bookmarks.map(serializeBookmark))
      })
      .catch(next)
  })
  .post(bodyParser, (req, res) => {
    for (const field of ['title', 'url', 'rating']) {
      if (!req.body[field]) {
        logger.error(`${field} is required`)
        return res.status(400).send(`'${field}' is required`)
      }
    }
    const { title, url, description, rating } = req.body

    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
      logger.error(`Invalid rating '${rating}' supplied`)
      return res.status(400).send(`'rating' must be a number between 0 and 5`)
    }

    if (!isWebUri(url)) {
      logger.error(`Invalid url '${url}' supplied`)
      return res.status(400).send(`'url' must be a valid URL`)
    }

    const bookmark = { id: uuid(), title, url, description, rating }

    store.bookmarks.push(bookmark)

    logger.info(`Bookmark with id ${bookmark.id} created`)
    res
      .status(201)
      .location(`http://localhost:8000/bookmarks/${bookmark.id}`)
      .json(serializeBookmark(bookmark))
  })

bookmarksRouter
  .route('/bookmarks/:bookmark_id')
  .all((req, res, next) => {
    const {bookmark_id} = req.params
    BookmarksService.getById(req.app.get('db'), bookmark_id)
      .then(bookmark => {
        if (!bookmark) {
          logger.error(`Bookmark with id ${bookmark_id} not found.`)
          return res
            .status(404)
            .json({
              error: {message: `Bookmark not found`}
            })
        }
        res.bookmark = bookmark
        next()
      })
      .catch(next)
  })
  .get((req, res) => {
    res
      .json(serializeBookmark(res.bookmark))
  })
  
  .delete((req, res) => {
    const { bookmark_id } = req.params
    BookmarksService.deleteBookmark(
      req.app.get('db'),
      bookmark_id
    )
      .then(numRowsAffected => {
        logger.info(`Bookmark with id ${bookmark_id} deleted.`)
        res
          .status(204)
          .end()
      })
      .catch(next)
  })

  .patch(bodyParser, (req, res, next) => {
    const {title, url, description, rating} = req.body
    const bookmarkToUpdate = {title, url, description, rating}

    const numberOfValues = Object.values(articleToUpdate).filter(Boolean).length
    if (numberOfValues === 0) {
      return res
        .status(400)
        .json({
          error: {message: `Request body must contain either 'title', 'url', 'description', 'rating'`}
        })
    }

    const error = getBookmarkValidationError(bookmarkToUpdate)

    if (error) return res.status(400).send(error)

    BookmarksService.updateBookmark(
      req.app.get('db'),
      req.params.article_id,
      bookmarkToUpdate
    )
      .then(numRowsAffected => {
        res 
          .status(204)
          .end()
      })
      .catch(next)

  })

module.exports = bookmarksRouter