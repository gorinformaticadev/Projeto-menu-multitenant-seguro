<div id="page-content" class="page-wrapper clearfix">
    <div class="card">
        <div class="page-title clearfix rounded">
            <div class="d-flex justify-content-between align-items-center">
                <h1><?php echo app_lang('bot_flow_builder'); ?></h1>
                <?php if (check_wb_permission($user, 'wb_create_bot_flow')) { ?>
                    <div class="title-button-group">
                        <?php echo modal_anchor(get_uri("whatsboost/flow"), "<i data-feather='plus-circle' class='icon-16'></i> " . app_lang('new_flow'), array("class" => "btn btn-primary", "title" => app_lang('flow_details'))); ?>
                    </div>
                <?php } ?>
            </div>
        </div>
        <div class="table-responsive">
            <table id="flows_table" class="display" cellspacing="0" width="100%">
            </table>
        </div>
    </div>
</div>

<script type="text/javascript">
    "use strict";

    $(function() {
        $("#flows_table").appTable({
            source: '<?php echo_uri("whatsboost/flows/table"); ?>',
            columns: [{
                    title: '#'
                },
                {
                    title: '<?php echo app_lang('name'); ?>'
                },
                {
                    title: '<?php echo app_lang('active'); ?>'
                },
                {
                    title: '<?php echo app_lang('action'); ?>',
                    class: "text-center option w175"
                },
            ],
            order: [
                [0, "desc"]
            ],
            printColumns: [0, 1, 2, 3],
            xlsColumns: [0, 1, 2, 3]
        });

        $(document).on('change', '#active_deactive_flow', function(event) {
            var is_active = 0;
            if ($(this).prop("checked") === true) {
                is_active = 1;
            }
            $.ajax({
                url: '<?php echo_uri('whatsboost/bots/active_deactive_flow'); ?>',
                type: 'post',
                data: {
                    id: $(this).data('id'),
                    is_active: is_active,
                },
                dataType: 'json'
            }).done(function(res) {
                appAlert.success(res.message, {
                    duration: 2000
                });
            });
        });
    });
</script>
