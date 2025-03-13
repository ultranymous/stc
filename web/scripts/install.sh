bash scripts/build.sh

DATA_CID=bafyb4ihts2f5gsijugesi6xpemc6qmicbddrqi72xxdlogx3hnp3722dau
DOIS_CID=bafyb4iavcvzqzamnr7xa5fmanlc274rsk3iydgoxownvvb2ocbinbj3yay
REPO_CID=bafyb4idojhtykgtzzglaycyhe23f7ebn4oql3kdwp5tdmct2m4a374s6yu

echo Copying site to IPFS...
DIST_CID=$(ipfs --api $API_ADDR add --pin -Q -r --hash=blake3 dist)

echo Settings up MFS...
ipfs --api $API_ADDR files rm -r /stc
ipfs --api $API_ADDR files cp /ipfs/$DIST_CID /stc

STC_WEB_CID=$(ipfs --api $API_ADDR files stat /stc | head -n 1)
ipfs --api $API_ADDR files cp -p /ipfs/$STC_WEB_CID /stc/web

ipfs --api $API_ADDR files cp -p /ipfs/$DATA_CID /stc/data
ipfs --api $API_ADDR files cp -p /ipfs/$DOIS_CID /stc/dois
ipfs --api $API_ADDR files cp -p /ipfs/$REPO_CID /stc/repo

#ipfs --api $API_ADDR files cp -p /ipfs/bafybeiaysi4s6lnjev27ln5icwm6tueaw2vdykrtjkwiphwekaywqhcjze/I /stc/images/wiki
STC_CID=$(ipfs --api $API_ADDR files stat /stc | head -n 1)
ipfs --api $API_ADDR routing provide $STC_CID
echo New LibSTC CID is $STC_CID