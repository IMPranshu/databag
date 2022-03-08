package databag

import (
  "net/http"
  "time"
  "encoding/hex"
  "databag/internal/store"
  "github.com/theckman/go-securerandom"
)

func AddAccountAuthentication(w http.ResponseWriter, r *http.Request) {

  id, err := AccountLogin(r)
  if err != nil {
    ErrResponse(w, http.StatusUnauthorized, err)
    return
  }

  data, res := securerandom.Bytes(4)
  if res != nil {
    ErrResponse(w, http.StatusInternalServerError, res)
    return
  }
  token := hex.EncodeToString(data)

  accountToken := store.AccountToken{
    AccountID: id,
    TokenType: APP_ACCOUNTRESET,
    Token: token,
    Expires: time.Now().Unix() + APP_RESETEXPIRE,
  }
  if err := store.DB.Create(&accountToken).Error; err != nil {
    ErrResponse(w, http.StatusInternalServerError, err)
    return
  }

  WriteResponse(w, token)
}



