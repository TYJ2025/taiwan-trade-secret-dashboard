#!/bin/bash
# Copy trade secret case data from Downloads to project folder
cp ~/Downloads/trade_secret_cases_complete.json ~/Documents/Claude/Projects/Taiwan\ Trade\ Secrets\ Case\ Tracker/trade_secret_cases_master.json
cp ~/Downloads/trade_secret_cases_complete.csv ~/Documents/Claude/Projects/Taiwan\ Trade\ Secrets\ Case\ Tracker/trade_secret_cases_master.csv
cp ~/Downloads/trade_secret_cases_batch1.json ~/Documents/Claude/Projects/Taiwan\ Trade\ Secrets\ Case\ Tracker/trade_secret_cases_batch1.json
cp ~/Downloads/trade_secret_cases_batch2_ipc_older.json ~/Documents/Claude/Projects/Taiwan\ Trade\ Secrets\ Case\ Tracker/trade_secret_cases_batch2.json
echo "Done! Files copied to project folder."
ls -la ~/Documents/Claude/Projects/Taiwan\ Trade\ Secrets\ Case\ Tracker/trade_secret*
